import { NotFoundException } from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { NutritionService } from '../src/nutrition/nutrition.service.js';
import type { Nutrition } from '../src/nutrition/schemas/nutrition.schema.js';

describe('user-owned meal operations', () => {
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
