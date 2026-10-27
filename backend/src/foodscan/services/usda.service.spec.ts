import { afterEach, describe, expect, it, vi } from 'vitest';
import { FoodScanConfigService } from '../../common/foodscan/foodscan-config.js';
import { UsdaService } from './usda.service.js';

describe('USDA search request construction', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends food search terms and USDA data types as a JSON POST body', async () => {
    const fetchJson = vi.fn().mockResolvedValue({ foods: [] });
    const service = new UsdaService(
      {
        value: {
          usda: {
            apiKey: 'test-key',
            base: 'https://api.nal.usda.gov/fdc/v1/',
            configured: true,
          },
        },
      } as FoodScanConfigService,
      { fetchJson } as never,
    );

    await service.searchCandidates('chicken & rice, raw');

    const requestedUrl = new URL(fetchJson.mock.calls[0][0] as string);
    expect(requestedUrl.pathname).toBe('/fdc/v1/foods/search');
    expect(requestedUrl.searchParams.get('api_key')).toBe('test-key');
    expect([...requestedUrl.searchParams.keys()]).toEqual(['api_key']);
    const options = fetchJson.mock.calls[0][1];
    expect(options.method).toBe('POST');
    expect(options.headers['content-type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ query: 'chicken & rice, raw', pageSize: 25, dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'] });
  });

  it('reads Foundation Food energy and never turns missing calories into zero', async () => {
    const foods = [
      { fdcId: 990001, description: 'Chicken breast', dataType: 'Foundation', foodNutrients: [{ nutrient: { id: 1003 }, amount: 22.5 }, { nutrient: { id: 1004 }, amount: 1.9 }, { nutrient: { id: 2047, unitName: 'kcal' }, amount: 120 }] },
      { fdcId: 990002, description: 'Food', dataType: 'Foundation', foodNutrients: [{ nutrient: { id: 2047, unitName: 'kcal' }, amount: 120 }, { nutrient: { id: 2048, unitName: 'kcal' }, amount: 115 }, { nutrient: { id: 1008, unitName: 'kcal' }, amount: 0 }] },
      { fdcId: 990003, description: 'Unknown', dataType: 'Foundation', foodNutrients: [{ nutrient: { id: 1003 }, amount: 20 }] },
      { fdcId: 990004, description: 'Water', dataType: 'Foundation', foodNutrients: [{ nutrient: { id: 2047, unitName: 'kcal' }, amount: 0 }] },
      { fdcId: 990005, description: 'Label', dataType: 'Branded', servingSize: 50, servingSizeUnit: 'G', foodNutrients: [{ nutrient: { id: 1003 }, amount: 10 }], labelNutrients: { calories: { value: 75 } } },
    ];
    const fetchJson = vi.fn().mockImplementation(async (url: string) => foods.find(food => url.includes(`/food/${food.fdcId}?`)));
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson } as never);
    expect((await service.getNutrients(990001)).kcal_per_100g).toBe(120);
    expect((await service.getNutrients(990002)).kcal_per_100g).toBe(115);
    await expect(service.getNutrients(990003)).rejects.toThrow('Calories are unavailable');
    expect((await service.getNutrients(990004)).kcal_per_100g).toBe(0);
    expect((await service.getNutrients(990005)).kcal_per_100g).toBe(150);
  });
});
