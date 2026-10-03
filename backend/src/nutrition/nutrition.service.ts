import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { MealDto, WaterDto } from './dto/nutrition.dto.js';
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
}
