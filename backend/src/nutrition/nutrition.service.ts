import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { MealDto, MealFromScanDto, WaterDto } from './dto/nutrition.dto.js';
import { Nutrition, type NutritionDocument } from './schemas/nutrition.schema.js';

@Injectable()
export class NutritionService {
  constructor(@InjectModel(Nutrition.name) private readonly model: Model<Nutrition>) {}

  async get(userId: string): Promise<NutritionDocument> {
    return this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), meals: [], water: [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async addMeal(userId: string, dto: MealDto): Promise<NutritionDocument> {
    const meal = { ...dto, id: dto.id || randomUUID(), date: dto.date || new Date().toISOString().slice(0, 10) };
    return this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $push: { meals: meal } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async updateMeal(userId: string, id: string, dto: MealDto): Promise<NutritionDocument> {
    const current = await this.get(userId);
    const index = current.meals.findIndex((meal) => meal.id === id);
    if (index < 0) throw new NotFoundException('Meal not found');
    Object.assign(current.meals[index], dto, { id });
    return current.save();
  }

  async deleteMeal(userId: string, id: string): Promise<NutritionDocument> {
    const updated = await this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $pull: { meals: { id } } },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Nutrition state not found');
    return updated;
  }

  async setWater(userId: string, dto: WaterDto): Promise<NutritionDocument> {
    const current = await this.get(userId);
    const existing = current.water.find((entry) => entry.date === dto.date);
    if (existing) existing.glasses = dto.glasses;
    else current.water.push(dto);
    return current.save();
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
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}
