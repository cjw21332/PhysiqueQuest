import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { DietaryPlanDto, MealDto, MealFromScanDto, WaterDto } from './dto/nutrition.dto.js';
import { Nutrition, type NutritionDocument } from './schemas/nutrition.schema.js';

@Injectable()
export class NutritionService {
  constructor(@InjectModel(Nutrition.name) private readonly model: Model<Nutrition>) {}

  async read(userId: string, projection?: string) {
    const query = this.model.findOne({ userId: new Types.ObjectId(userId) });
    if (projection) query.select(projection);
    return await query.lean().exec() ?? { meals: [], water: [] };
  }

  async get(userId: string): Promise<NutritionDocument> {
    return this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), meals: [], water: [] } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
  }

  async addMeal(userId: string, dto: MealDto): Promise<NutritionDocument> {
    const meal = { ...dto, id: dto.id || randomUUID(), date: dto.date || new Date().toISOString().slice(0, 10) };
    return this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $push: { meals: meal } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
  }

  async updateMeal(userId: string, id: string, dto: MealDto): Promise<NutritionDocument> {
    const patch: Record<string, unknown> = { 'meals.$.edited': true };
    for (const key of ['name', 'meal', 'calories', 'detail', 'protein', 'carbs', 'fat', 'fdcId'] as const) {
      if (dto[key] !== undefined) patch[`meals.$.${key}`] = dto[key];
    }
    const updated = await this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), 'meals.id': id }, { $set: patch }, { returnDocument: 'after', runValidators: true },
    );
    if (!updated) throw new NotFoundException('Meal not found');
    return updated;
  }

  async deleteMeal(userId: string, id: string): Promise<NutritionDocument> {
    const updated = await this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), 'meals.id': id },
      { $pull: { meals: { id } } },
      { returnDocument: 'after' },
    );
    if (!updated) throw new NotFoundException('Meal not found');
    return updated;
  }

  async setPlan(userId: string, dto: DietaryPlanDto) {
    if (dto.protein + dto.carbs + dto.fat !== 100) throw new BadRequestException('Macro percentages must add up to 100');
    return this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { dietaryPlan: { ...dto, startedAt: dto.startedAt ?? new Date().toISOString() } } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true },
    );
  }

  async setWater(userId: string, dto: WaterDto): Promise<NutritionDocument> {
    return this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      [{ $set: {
        meals: { $ifNull: ['$meals', []] },
        water: { $concatArrays: [{ $filter: { input: { $ifNull: ['$water', []] }, as: 'entry', cond: { $ne: ['$$entry.date', { $literal: dto.date }] } } }, { $literal: [{ date: dto.date, glasses: dto.glasses }] }] },
        createdAt: { $ifNull: ['$createdAt', '$$NOW'] },
      } }],
      { upsert: true, returnDocument: 'after', updatePipeline: true },
    );
  }

  /**
   * Writes one meal row per item a scan actually priced.
   *
   * Items with `found: false` carry no USDA match and therefore no meaningful
   * macros, so they are skipped rather than stored as a zero-calorie meal. If
   * that leaves nothing to write the whole request is rejected: silently
   * recording an empty meal would look like a successful save.
   */
  async addMealsFromScan(userId: string, dto: MealFromScanDto): Promise<NutritionDocument> {
    const matched = dto.items.filter((item) => item.found);
    if (matched.length === 0) {
      throw new BadRequestException('None of the scanned items matched a nutrition record');
    }

    const date = dto.date || new Date().toISOString().slice(0, 10);
    const meals = matched.map((item) => ({
      id: randomUUID(),
      name: item.food_name,
      meal: dto.meal,
      calories: item.kcal,
      detail: item.description ?? '',
      time: dto.time ?? '',
      source: 'Scanned',
      protein: item.protein_g,
      carbs: item.carbs_g,
      fat: item.fat_g,
      date,
      // Spread conditionally so an unmatched optional field is absent from the
      // document rather than persisted as an explicit null.
      ...(item.fdc_id === undefined ? {} : { fdcId: item.fdc_id }),
      ...(item.confidence === undefined ? {} : { confidence: item.confidence }),
      ...(item.est_weight_g === undefined ? {} : { estWeightG: item.est_weight_g }),
    }));

    return this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $push: { meals: { $each: meals } } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
  }
}
