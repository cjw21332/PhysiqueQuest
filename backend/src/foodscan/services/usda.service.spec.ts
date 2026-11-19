import { afterEach, describe, expect, it, vi } from 'vitest';
import { FoodScanConfigService } from '../../common/foodscan/foodscan-config.js';
import { UsdaService } from './usda.service.js';

describe('USDA search request construction', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not present an arbitrary food portion as a standard serving', async () => {
    const food = { fdcId: 990100, description: 'Test food', dataType: 'Foundation', foodPortions: [{ amount: 2, modifier: 'slices', gramWeight: 80 }] };
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson: vi.fn().mockResolvedValue(food) } as never);
    expect((await service.getNutrients(food.fdcId)).servingSizeG).toBeUndefined();
  });

  it('returns a serving weight when the food record states one in grams', async () => {
    const food = { fdcId: 990101, description: 'Test labelled food', dataType: 'Branded', servingSize: 35, servingSizeUnit: 'g' };
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson: vi.fn().mockResolvedValue(food) } as never);
    expect((await service.getNutrients(food.fdcId)).servingSizeG).toBe(35);
  });

  it('caches confirmed empty searches but retries failures', async () => {
    const fetchJson = vi.fn().mockResolvedValue({ foods: [] });
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson } as never);
    await service.lookupFood('unique cached absent dish');
    await service.lookupFood('unique cached absent dish');
    expect(fetchJson).toHaveBeenCalledTimes(2);
    fetchJson.mockRejectedValueOnce(new Error('temporary')).mockResolvedValue({ foods: [] });
    await expect(service.lookupFood('unique transient absent dish')).rejects.toThrow();
    await service.lookupFood('unique transient absent dish');
    expect(fetchJson).toHaveBeenCalledTimes(5);
  });

  it('does not automatically match unspecified chicken to raw chicken', async () => {
    const raw = { fdcId: 990091, description: 'Chicken breast, raw', dataType: 'Foundation', foodNutrients: [] };
    const fetchJson = vi.fn().mockResolvedValue({ foods: [raw] });
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson } as never);
    await expect(service.lookupFood('chicken breast')).resolves.toBeUndefined();
  });
  it('does not substitute mature yardlong bean seeds for the cooked pods', async () => {
    const food = { fdcId: 990090, description: 'Yardlong beans, mature seeds, cooked', dataType: 'SR Legacy', foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 118 }] };
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson: vi.fn().mockResolvedValue({ foods: [food] }) } as never);
    await expect(service.lookupFood('yardlong bean cooked', false)).resolves.toBeUndefined();
  });
  it('does not substitute breaded fried fast-food chicken for unspecified chicken pieces', async () => {
    const food = { fdcId: 990099, description: 'Fast foods, chicken, breaded and fried, boneless pieces, plain', dataType: 'Survey (FNDDS)', foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 300 }] };
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson: vi.fn().mockResolvedValue({ foods: [food] }) } as never);
    await expect(service.lookupFood('chicken pieces', false)).resolves.toBeUndefined();
  });
  it('does not substitute pickled meat or unprepared vegetables for visible cooked ingredients', async () => {
    const foods = [
      { fdcId: 990097, description: 'Pork, pickled pork hocks', dataType: 'Survey (FNDDS)', foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 171 }] },
      { fdcId: 990098, description: 'Okra, frozen, unprepared', dataType: 'Foundation', foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 30 }] },
    ];
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson: vi.fn().mockResolvedValue({ foods }) } as never);
    await expect(service.lookupFood('pork', false)).resolves.toBeUndefined();
    await expect(service.lookupFood('okra', false)).resolves.toBeUndefined();
  });
  it('does not automatically match generic white rice to glutinous rice', async () => {
    const rice = { fdcId: 990092, description: 'Rice, white, glutinous, cooked', dataType: 'Foundation', foodNutrients: [] };
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson: vi.fn().mockResolvedValue({ foods: [rice] }) } as never);
    await expect(service.lookupFood('white rice cooked')).resolves.toBeUndefined();
  });
  it('does not match a dish to a rice bowl when rice was not requested', async () => {
    const bowl = { fdcId: 990093, description: 'Adobo chicken with rice bowl', dataType: 'Branded', foodNutrients: [] };
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson: vi.fn().mockResolvedValue({ foods: [bowl] }) } as never);
    await expect(service.lookupFood('chicken adobo')).resolves.toBeUndefined();
  });
  it('does not auto-select branded entries when matching visible ingredients', async () => {
    const fetchJson = vi.fn().mockResolvedValue({ foods: [] });
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson } as never);
    await expect(service.lookupFood('unique pictured pork pieces', false)).resolves.toBeUndefined();
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchJson.mock.calls[0][1].body).dataType).not.toContain('Branded');
  });
  it('does not match an ingredient to a dish that excludes it or contains another protein', async () => {
    const food = { fdcId: 990095, description: 'Beef and vegetables excluding dark-green leafy greens', dataType: 'Survey (FNDDS)', foodNutrients: [] };
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson: vi.fn().mockResolvedValue({ foods: [food] }) } as never);
    await expect(service.lookupFood('leafy greens', false)).resolves.toBeUndefined();
  });
  it('marks physically impossible converted nutrient values unavailable', async () => {
    const food = { fdcId: 990096, description: 'Pork', dataType: 'Branded', servingSize: 4, servingSizeUnit: 'G', labelNutrients: { calories: { value: 120 }, protein: { value: 23 }, fat: { value: 2.5 }, carbohydrates: { value: 0 } } };
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson: vi.fn().mockResolvedValue(food) } as never);
    expect(await service.getNutrients(990096)).toMatchObject({ kcal_per_100g: null, protein_g_per_100g: null, carbs_g_per_100g: null, fat_g_per_100g: null });
  });

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
  it('does not match cooked rice to a rice-noodle product', async () => {
    const food = { fdcId: 990101, description: 'Rice noodles, cooked', dataType: 'Survey (FNDDS)', foodNutrients: [] };
    const fetchJson = vi.fn().mockResolvedValue({ foods: [food] });
    const service = new UsdaService({ value: { usda: { apiKey: 'test', base: 'https://example.test', configured: true } } } as FoodScanConfigService, { fetchJson } as never);
    await expect(service.lookupFood('cooked rice', false)).resolves.toBeUndefined();
  });

});
