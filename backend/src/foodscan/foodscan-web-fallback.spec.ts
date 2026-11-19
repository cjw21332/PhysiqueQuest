import { describe, expect, it, vi } from 'vitest';
import { FoodScanService } from './foodscan.service.js';
import { researchNutrition } from './services/web-nutrition.js';

vi.mock('./services/web-nutrition.js', () => ({ researchNutrition: vi.fn() }));

describe('scan nutrition fallback', () => {
  it('uses web research when the food is not in USDA', async () => {
    vi.stubEnv('JWT_SECRET', 'a sufficiently long test secret for evidence');
    vi.mocked(researchNutrition).mockResolvedValue({
      nutrition_ref: 'web:test',
      description: 'Regional dish',
      source: 'Web nutrition estimate: https://example.org/dish',
      kcal_per_100g: 150,
      protein_g_per_100g: 8,
      carbs_g_per_100g: 20,
      fat_g_per_100g: 4,
    });
    const vision = { detectFoods: vi.fn().mockResolvedValue([{ food_name: 'regional dish', est_weight_g: 200, confidence: 0.8 }]) };
    const usda = { lookupFood: vi.fn().mockResolvedValue(undefined) };
    const schemas = { normalizeImagePayload: () => ({ base64: 'AAAA', mimeType: 'image/jpeg' }) };
    const service = new FoodScanService({ value: {} } as never, schemas as never, vision as never, usda as never);
    try {
      const result = await service.analyze({ image: 'AAAA' }, 'test', undefined, 'user-one');
      expect(researchNutrition).toHaveBeenCalledWith('regional dish', 'user-one', undefined);
      expect(result.items[0]).toMatchObject({ found: true, nutrition_ref: 'web:test', kcal: 300, protein_g: 16 });
    } finally {
      vi.unstubAllEnvs();
      vi.resetAllMocks();
    }
  });
});
