import { describe, expect, it } from 'vitest';
import { NutritionService } from '../src/nutrition/nutrition.service.js';
import { SettingsService } from '../src/settings/settings.service.js';

describe('user-owned persistence services', () => {
  it('creates an empty nutrition state instead of seeding sample meals', async () => {
    const state = { meals: [], water: [] };
    const model = {
      findOneAndUpdate: async () => state,
    } as any;
    const result = await new NutritionService(model).get('507f1f77bcf86cd799439011');
    expect(result.meals).toEqual([]);
    expect(result.water).toEqual([]);
  });

  it('merges settings into one user-owned state', async () => {
    const state: any = { values: { threshold: 30 }, save: async function () { return this; } };
    const model = {
      findOneAndUpdate: async () => state,
    } as any;
    const result = await new SettingsService(model).update('507f1f77bcf86cd799439011', {
      values: { threshold: 45, notifications: true },
    });
    expect(result.values).toEqual({ threshold: 45, notifications: true });
  });
});
