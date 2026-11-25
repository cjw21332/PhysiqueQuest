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
import { researchedRecipeById } from '../foodscan/services/researched-recipes.js';
import { verifiedWebNutrition } from '../foodscan/services/web-nutrition.js';
import { readEvidenceProof } from '../foodscan/services/evidence-proof.js';

/** Meals and water may be back-filled up to 30 days; a day ahead allows for time zones, nothing further. */
export function assertLoggableDate(date?: string) {
  if (!date) return;
  const day = Date.parse(`${date}T00:00:00Z`), now = Date.now();
  if (!Number.isFinite(day) || day > now + 86400000 || day < now - 31 * 86400000) throw new BadRequestException('Meals and water can be logged for today or up to 30 days back.');
}

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

  async addMeal(userId: string, dto: MealDto): Promise<NutritionDocument> { assertLoggableDate(dto.date);
    const meal = { ...dto, id: dto.id || randomUUID(), date: dto.date || new Date().toISOString().slice(0, 10) };
    return this.withActiveWrite(userId, async session => this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $push: { meals: meal } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session },
    ));
  }

  async updateMeal(userId: string, id: string, dto: MealDto): Promise<NutritionDocument> {
    const patch: Record<string, unknown> = { 'meals.$.edited': true };
    for (const key of ['name', 'meal', 'calories', 'detail', 'protein', 'carbs', 'fat', 'saturatedFat', 'transFat', 'fiber', 'sugars', 'addedSugar', 'sodium', 'cholesterol', 'fdcId', 'estWeightG', 'servingQuantity', 'servingUnit', 'servingSizeG'] as const) {
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
      [{ $set: {
        previousCalorieTarget: { $cond: [
          { $and: [{ $isNumber: '$dietaryPlan.calories' }, { $ne: ['$dietaryPlan.calories', dto.calories] }] },
          '$dietaryPlan.calories', { $ifNull: ['$previousCalorieTarget', null] },
        ] },
        dietaryPlan: { $literal: { ...dto, startedAt: dto.startedAt ?? new Date().toISOString() } },
        meals: { $ifNull: ['$meals', []] }, water: { $ifNull: ['$water', []] },
      } }],
      { upsert: true, returnDocument: 'after', updatePipeline: true, session },
    ));
  }

  async setWater(userId: string, dto: WaterDto): Promise<NutritionDocument> { assertLoggableDate(dto.date);
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
    assertLoggableDate(dto.date);

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
    // All server-signed observations in one meal must originate from the same
    // analysis. Manual entries have no proof and may be added during review.
    const proofs = dto.items.flatMap(item => item.evidence_ref ? [item.evidence_ref] : []);
    if (new Set(proofs).size !== proofs.length) throw new BadRequestException('A food evidence reference was used more than once.');
    const verifiedProofs = proofs.map(proof => {
      const payload = readEvidenceProof(proof, userId);
      if (!payload) throw new BadRequestException('The food evidence has expired or is invalid. Scan the meal again.');
      return { proof, payload };
    });
    const contexts = verifiedProofs.map(({ payload }) => payload.scan ? JSON.stringify(payload.scan) : 'legacy');
    if (new Set(contexts).size > 1) throw new BadRequestException('Food evidence from different scans cannot be combined.');
    // A whole new-format scan can be saved once, even if only a subset of its
    // items was selected. Legacy references are consumed individually.
    const consumptionIds = [...new Set(verifiedProofs.map(({ proof, payload }) => createHash('sha256').update(payload.scan ? `scan:${payload.scan.id}` : `legacy:${proof}`).digest('hex')))];
    const scanGroupId = key || randomUUID();
    const savedAt = new Date();
    const meals = await mapConcurrent(dto.items, 4, async (item) => {
      if (!Number.isFinite(item.est_weight_g) || !item.est_weight_g || item.est_weight_g <= 0 || item.est_weight_g > 5000) throw new BadRequestException('Each food needs a weight between 0 and 5000 g');
      if ((item.entered_quantity === undefined) !== (item.entered_unit === undefined)) throw new BadRequestException('Quantity and unit must be provided together');
      if (item.entered_quantity !== undefined && item.entered_unit !== undefined) {
        const factors = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 };
        const grams = item.entered_quantity * factors[item.entered_unit];
        if (!Number.isFinite(grams) || grams <= 0 || Math.abs(grams - item.est_weight_g) > 0.11) throw new BadRequestException('The quantity does not match the food weight');
      }
      const trustedEvidence = item.evidence_ref ? readEvidenceProof(item.evidence_ref, userId) : undefined;
      if (item.evidence_ref && !trustedEvidence) throw new BadRequestException('The food evidence has expired or is invalid. Scan the meal again.');
      if (item.found && Boolean(item.fdc_id) === Boolean(item.nutrition_ref)) throw new BadRequestException('Select one nutrition record for each matched food');
      const recipe = item.nutrition_ref ? researchedRecipeById(item.nutrition_ref) ?? verifiedWebNutrition(item.nutrition_ref, userId) : undefined;
      if (item.nutrition_ref && !recipe) throw new BadRequestException('The selected nutrition record is unavailable. Choose another food.');
      if (item.found && item.fdc_id && !this.usda) throw new BadRequestException('Nutrition verification is unavailable');
      let record;
      try { record = item.found ? recipe ?? await this.usda!.getNutrients(item.fdc_id!) : undefined; }
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
      ...(item.entered_quantity === undefined ? {} : { servingQuantity: item.entered_quantity, servingUnit: item.entered_unit }),
      ...(record ? { nutritionProvider: recipe ? recipe.source : 'USDA FoodData Central', nutritionDescription: record.description, nutritionPer100g: per100 } : {}),
      identificationMethod: item.identification_method ?? 'ai',
      ...(item.weight_corrected === undefined ? {} : { weightCorrected: item.weight_corrected }),
      ...(item.preparation_correction?.trim() ? { preparation: item.preparation_correction.trim() } : {}),
      ...(item.added_oil_correction?.trim() ? { addedOil: item.added_oil_correction.trim() } : {}),
      ...(item.evidence ? { foodEvidence: (() => {
        const trusted = trustedEvidence;
        if (!trusted) return {
          name: item.identification_method === 'manual' ? 'user_confirmed' : 'unknown',
          quantity: item.identification_method === 'manual' ? 'user_confirmed' : 'unknown',
          preparation: item.preparation_correction?.trim() ? 'user_confirmed' : 'unknown', added_oil: item.added_oil_correction?.trim() ? 'user_confirmed' : 'unknown',
        };
        return { ...trusted.evidence,
          name: item.food_name !== trusted.name ? 'user_confirmed' : trusted.evidence.name,
          quantity: item.est_weight_g !== trusted.grams ? 'user_confirmed' : trusted.evidence.quantity,
          preparation: item.preparation_correction?.trim() ? 'user_confirmed' : trusted.evidence.preparation,
          added_oil: item.added_oil_correction?.trim() ? 'user_confirmed' : trusted.evidence.added_oil,
        };
      })() } : {}),
      scanSavedAt: savedAt,
      scanGroupId,
    }); });

    return this.withActiveWrite(userId, async session => {
    if (key) {
      // The receipt and all rows are committed together in one user document.
      // Concurrent first saves may race on the existing unique userId index.
      const prior = await replay(session);
      if (prior) return prior;
    }
    if (consumptionIds.length) {
      // The same transaction commits consumption and meal rows. A rollback
      // leaves the evidence usable; concurrent writers cannot both consume it.
      await this.model.findOneAndUpdate({ userId: owner }, { $setOnInsert: { userId: owner, meals: [], water: [] } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session });
      const consumed = await this.model.updateOne(
        { userId: owner, consumedScanEvidence: { $nin: consumptionIds } },
        { $addToSet: { consumedScanEvidence: { $each: consumptionIds } } },
        { session },
      );
      if (consumed.matchedCount !== 1) throw new ConflictException('This scan has already been saved.');
    }
    if (key) {
      if (!consumptionIds.length) await this.model.findOneAndUpdate({ userId: owner }, { $setOnInsert: { userId: owner, meals: [], water: [] } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session });
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
