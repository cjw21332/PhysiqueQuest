import { NotFoundException } from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { NutritionService } from '../src/nutrition/nutrition.service.js';
import type { Nutrition } from '../src/nutrition/schemas/nutrition.schema.js';

describe('user-owned meal operations', () => {
  it('persists edited status while retaining the original source and logging time', async () => {
    const meal = { id: 'meal-1', name: 'Rice', meal: 'Lunch', calories: 130, source: 'Scanned', time: '12:40', date: '2026-10-14' };
    const document = { meals: [meal] };
    const update = vi.fn(async (_filter, patch) => {
      for (const [key, value] of Object.entries(patch.$set)) (meal as any)[key.replace('meals.$.', '')] = value;
      return document;
    });
    const model = { findOneAndUpdate: update } as unknown as Model<Nutrition>;
    await new NutritionService(model).updateMeal('507f1f77bcf86cd799439011', 'meal-1', { name: 'Rice bowl', meal: 'Lunch', calories: 150, source: 'Manual', time: '18:00' });
    expect(meal).toMatchObject({ name: 'Rice bowl', calories: 150, source: 'Scanned', time: '12:40', edited: true });
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][0]).toMatchObject({ 'meals.id': 'meal-1' });
  });
  it('scopes meal deletion to the user and rejects an unknown meal ID', async () => {
    const findOneAndUpdate = vi.fn().mockResolvedValue(null);
    const model = { findOneAndUpdate } as unknown as Model<Nutrition>;
    const service = new NutritionService(model);
    const userId = '507f1f77bcf86cd799439011';

    await expect(service.deleteMeal(userId, 'missing-meal')).rejects.toBeInstanceOf(NotFoundException);
    const [filter] = findOneAndUpdate.mock.calls[0] as [Record<string, unknown>];
    expect(filter.userId).toEqual(new Types.ObjectId(userId));
    expect(filter['meals.id']).toBe('missing-meal');
  });
});
