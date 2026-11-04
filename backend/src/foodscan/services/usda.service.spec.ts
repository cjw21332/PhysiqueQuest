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
    expect(await service.getNutrients(990003)).toMatchObject({ kcal_per_100g: null, protein_g_per_100g: 20, carbs_g_per_100g: null, fat_g_per_100g: null });
    expect((await service.getNutrients(990004)).kcal_per_100g).toBe(0);
    expect((await service.getNutrients(990005)).kcal_per_100g).toBe(150);
    expect(await service.getNutrients(990004)).toMatchObject({ kcal_per_100g: 0, protein_g_per_100g: null, carbs_g_per_100g: null, fat_g_per_100g: null });
  });

  it('chooses the complete exact match from prepared and branded datasets over a nutrient-empty partial match', async () => {
    const empty = { fdcId: 1, description: 'Oil, peanut', dataType: 'Foundation', foodNutrients: [] };
    const brittle = { fdcId: 2, description: 'Peanut brittle', dataType: 'Branded', foodNutrients: [
      { nutrientId: 1008, unitName: 'KCAL', value: 425 }, { nutrientId: 1003, value: 5 },
      { nutrientId: 1005, value: 70 }, { nutrientId: 1004, value: 15 },
    ] };
    const fetchJson = vi.fn().mockImplementation(async (url: string, options: { body?: string }) => {
      if (url.includes('/foods/search')) {
        const body = JSON.parse(options.body!);
        return body.dataType.includes('Branded') ? { foods: [brittle] } : { foods: [empty] };
      }
      if (url.includes('/food/2?')) return { ...brittle, foodNutrients: [] };
      throw new Error('unexpected request');
    });
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson } as never);
    await expect(service.lookupFood('peanut brittle')).resolves.toMatchObject({
      fdcId: 2, description: 'Peanut brittle', kcal_per_100g: 425, protein_g_per_100g: 5, carbs_g_per_100g: 70, fat_g_per_100g: 15,
    });
    expect(fetchJson.mock.calls.filter(([, options]) => JSON.parse(options.body ?? '{}').dataType?.includes('Branded'))).toHaveLength(1);
  });

  it('uses a complete search payload if its detail request is temporarily unavailable', async () => {
    const food = { fdcId: 3, description: 'Sesame brittle', dataType: 'Survey (FNDDS)', foodNutrients: [
      { nutrientNumber: '208', unitName: 'KCAL', value: 480 }, { nutrientNumber: '203', value: 8 },
      { nutrientNumber: '205', value: 65 }, { nutrientNumber: '204', value: 20 },
    ] };
    const fetchJson = vi.fn().mockImplementation(async (url: string) => url.includes('/foods/search') ? { foods: [food] } : Promise.reject(new Error('temporary outage')));
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson } as never);
    await expect(service.lookupFood('sesame brittle')).resolves.toMatchObject({
      kcal_per_100g: 480, protein_g_per_100g: 8, carbs_g_per_100g: 65, fat_g_per_100g: 20,
    });
  });
});
