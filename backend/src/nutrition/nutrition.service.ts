import { Injectable, BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession } from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { DietaryPlanDto, MealDto, MealFromScanDto, WaterDto } from './dto/nutrition.dto.js';
import { Nutrition, type NutritionDocument } from './schemas/nutrition.schema.js';
import { UsdaService } from '../foodscan/services/usda.service.js';
import { mapConcurrent } from '../common/foodscan/http.service.js';
import { AppError, ErrorCode } from '../common/foodscan/errors.js';
import { AccountLifecycleFence } from '../privacy/account-lifecycle-fence.js';

@Injectable()
export class NutritionService implements OnModuleInit {
  constructor(@InjectModel(Nutrition.name) private readonly model: Model<Nutrition>, private readonly usda?: UsdaService) {}
  private withActiveWrite<T>(userId: string, write: (session: ClientSession) => Promise<T>, generation?: number) {
    return new AccountLifecycleFence(this.model.db).withActiveWrite(userId, write, generation);
  }

  async onModuleInit() {
    // Atomic first-save and per-user idempotency require exactly one document per user.
    // Do not silently proceed if legacy duplicates prevent this index.
    await this.model.collection.createIndex({ userId: 1 }, { unique: true, maxTimeMS: 30_000 });
  }

  async read(userId: string, projection?: string) {
    const query = this.model.findOne({ userId: new Types.ObjectId(userId) });
    if (projection) query.select(projection);
    return await query.lean().exec() ?? { meals: [], water: [] };
  }

  async scanSaveReceipt(userId: string, key: string) {
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(key)) throw new BadRequestException('Invalid save ID');
    const doc = await this.model.findOne({ userId: new Types.ObjectId(userId), 'scanSaveReceipts.key': key }).lean().exec();
    const receipt = doc?.scanSaveReceipts?.find(entry => entry.key === key);
    return receipt ? { status: 'confirmed', save_id: receipt.key, meal_ids: receipt.mealIds } : { status: 'unknown' };
  }

  async get(userId: string): Promise<NutritionDocument> {
    return this.withActiveWrite(userId, async session => this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), meals: [], water: [] } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session },
    ));
  }

  async addMeal(userId: string, dto: MealDto): Promise<NutritionDocument> {
    const meal = { ...dto, id: dto.id || randomUUID(), date: dto.date || new Date().toISOString().slice(0, 10) };
    return this.withActiveWrite(userId, async session => this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $push: { meals: meal } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session },
    ));
  }

  async updateMeal(userId: string, id: string, dto: MealDto): Promise<NutritionDocument> {
    const patch: Record<string, unknown> = { 'meals.$.edited': true };
    for (const key of ['name', 'meal', 'calories', 'detail', 'protein', 'carbs', 'fat', 'saturatedFat', 'transFat', 'fiber', 'sugars', 'addedSugar', 'sodium', 'cholesterol', 'fdcId'] as const) {
      if (dto[key] !== undefined) patch[`meals.$.${key}`] = dto[key];
    }
    return this.withActiveWrite(userId, async session => {
      const updated = await this.model.findOneAndUpdate(
        { userId: new Types.ObjectId(userId), 'meals.id': id }, { $set: patch }, { returnDocument: 'after', runValidators: true, session },
      );
      if (!updated) throw new NotFoundException('Meal not found');
      return updated;
    });
  }

  async deleteMeal(userId: string, id: string): Promise<NutritionDocument> {
    return this.withActiveWrite(userId, async session => {
    const updated = await this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), 'meals.id': id },
      { $pull: { meals: { id } } },
      { returnDocument: 'after', session },
    );
    if (!updated) throw new NotFoundException('Meal not found');
    return updated;
    });
  }

  async setPlan(userId: string, dto: DietaryPlanDto) {
    if (dto.protein + dto.carbs + dto.fat !== 100) throw new BadRequestException('Macro percentages must add up to 100');
    return this.withActiveWrite(userId, async session => this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { dietaryPlan: { ...dto, startedAt: dto.startedAt ?? new Date().toISOString() } } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true, session },
    ));
  }

  async setWater(userId: string, dto: WaterDto): Promise<NutritionDocument> {
    return this.withActiveWrite(userId, async session => this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      [{ $set: {
        meals: { $ifNull: ['$meals', []] },
        water: { $concatArrays: [{ $filter: { input: { $ifNull: ['$water', []] }, as: 'entry', cond: { $ne: ['$$entry.date', { $literal: dto.date }] } } }, { $literal: [{ date: dto.date, glasses: dto.glasses }] }] },
        createdAt: { $ifNull: ['$createdAt', '$$NOW'] },
      } }],
      { upsert: true, returnDocument: 'after', updatePipeline: true, session },
    ));
  }

  /**
   * Writes one row per selected food. Unmatched items retain null nutrition
   * so they can be reviewed later without inventing zero-calorie values.
   */
  async addMealsFromScan(userId: string, dto: MealFromScanDto): Promise<NutritionDocument | { save_id: string; meal_ids: string[] }> {
    if (dto.items.length === 0) throw new BadRequestException('Select at least one food to save');

    const key = dto.idempotency_key;
    const hash = key ? createHash('sha256').update(JSON.stringify({ meal: dto.meal, date: dto.date ?? null, time: dto.time ?? null, items: dto.items })).digest('hex') : '';
    const owner = new Types.ObjectId(userId);
    const generation = await new AccountLifecycleFence(this.model.db).generation(userId);
    const replay = async (session: ClientSession) => {
      const doc = await this.model.findOne({ userId: owner, 'scanSaveReceipts.key': key }).session(session).lean().exec();
      const receipt = doc?.scanSaveReceipts?.find(entry => entry.key === key);
      if (!receipt) return null;
      if (receipt.hash !== hash) throw new ConflictException('This save ID was already used for a different meal.');
      return { save_id: receipt.key, meal_ids: receipt.mealIds };
    };
    if (key) { const existing = await this.withActiveWrite(userId, replay, generation); if (existing) return existing; }

    const date = dto.date || new Date().toISOString().slice(0, 10);
    const meals = await mapConcurrent(dto.items, 4, async (item) => {
      if (!Number.isFinite(item.est_weight_g) || !item.est_weight_g || item.est_weight_g <= 0 || item.est_weight_g > 5000) throw new BadRequestException('Each food needs a weight between 0 and 5000 g');
      if (item.found && !item.fdc_id) throw new BadRequestException('Select a nutrition record for each matched food');
      if (item.found && !this.usda) throw new BadRequestException('Nutrition verification is unavailable');
      let record;
      try { record = item.found ? await this.usda!.getNutrients(item.fdc_id!) : undefined; }
      catch (error) {
        if (error instanceof AppError && error.code === ErrorCode.NOT_FOUND) throw new BadRequestException('The selected nutrition record is unavailable. Choose another food.');
        throw new ServiceUnavailableException('Nutrition verification is temporarily unavailable. Try saving again.');
      }
      const per100 = record ? { kcal: record.kcal_per_100g, protein_g: record.protein_g_per_100g, carbs_g: record.carbs_g_per_100g, fat_g: record.fat_g_per_100g } : undefined;
      const amount = (key: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') => {
        const value = per100?.[key];
        return value == null ? null : Math.round(value * item.est_weight_g! / 100 * 10) / 10;
      };
      return ({
      id: randomUUID(),
      name: item.food_name,
      meal: dto.meal,
      calories: amount('kcal'),
      detail: record?.description ?? '',
      time: dto.time ?? '',
      source: 'Scanned',
      protein: amount('protein_g'),
      carbs: amount('carbs_g'),
      fat: amount('fat_g'),
      date,
      // Spread conditionally so an unmatched optional field is absent from the
      // document rather than persisted as an explicit null.
      ...(!item.found || item.fdc_id === undefined ? {} : { fdcId: item.fdc_id }),
      ...(item.confidence === undefined || (item.identification_method && item.identification_method !== 'ai') ? {} : { confidence: item.confidence }),
      ...(item.est_weight_g === undefined ? {} : { estWeightG: item.est_weight_g }),
      ...(record ? { nutritionProvider: 'USDA FoodData Central', nutritionDescription: record.description, nutritionPer100g: per100 } : {}),
      identificationMethod: item.identification_method ?? 'ai',
      ...(item.weight_corrected === undefined ? {} : { weightCorrected: item.weight_corrected }),
      scanSavedAt: new Date(),
    }); });

    return this.withActiveWrite(userId, async session => {
    if (key) {
      // The receipt and all rows are committed together in one user document.
      // Concurrent first saves may race on the existing unique userId index.
      const prior = await replay(session);
      if (prior) return prior;
      await this.model.findOneAndUpdate({ userId: owner }, { $setOnInsert: { userId: owner, meals: [], water: [] } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session });
      const receipt = { key, hash, mealIds: meals.map(meal => meal.id) };
      const written = await this.model.findOneAndUpdate(
        { userId: owner, 'scanSaveReceipts.key': { $ne: key } },
        { $push: { meals: { $each: meals }, scanSaveReceipts: receipt } },
        { returnDocument: 'after', runValidators: true, session },
      );
      if (written) return { save_id: key, meal_ids: receipt.mealIds };
      const existing = await replay(session);
      if (existing) return existing;
      throw new ServiceUnavailableException('Could not confirm this meal save. Retry with the same save ID.');
    }
    return this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $push: { meals: { $each: meals } } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session },
    );
    }, generation);
  }
}
