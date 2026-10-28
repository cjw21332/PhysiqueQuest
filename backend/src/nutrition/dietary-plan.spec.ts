import { describe, expect, it, vi } from 'vitest';
import { NutritionService } from './nutrition.service.js';

describe('dietary plan', () => {
  it('rejects macro splits that do not total 100 and saves valid splits for the user', async () => {
    const findOneAndUpdate = vi.fn().mockResolvedValue({});
    const service = new NutritionService({ findOneAndUpdate } as never);
    const plan = { goal: 'Maintenance', calories: 2300, protein: 30, carbs: 45, fat: 25 };
    await expect(service.setPlan('507f1f77bcf86cd799439011', { ...plan, fat: 20 })).rejects.toThrow('Macro percentages must add up to 100');
    expect(findOneAndUpdate).not.toHaveBeenCalled();
    await service.setPlan('507f1f77bcf86cd799439011', plan);
    expect(findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ userId: expect.anything() }), { $set: { dietaryPlan: expect.objectContaining({ ...plan, startedAt: expect.any(String) }) } }, expect.objectContaining({ upsert: true }));
  });
});
