import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NutritionService } from '../src/nutrition/nutrition.service.js';
import type { MealFromScanDto } from '../src/nutrition/dto/nutrition.dto.js';

/**
 * The scan-to-meal helper turns a scan response into nutrition rows.
 *
 * The Mongoose model is stubbed so the mapping can be asserted directly: what
 * matters here is which fields land in the document, not how Mongo stores them.
 */
describe('NutritionService.addMealsFromScan', () => {
  const USER_ID = '64b7f1c2a1b2c3d4e5f60718';
  let findOneAndUpdate: ReturnType<typeof vi.fn>;
  let service: NutritionService;

  beforeEach(() => {
    findOneAndUpdate = vi.fn(async () => ({ meals: [] }));
    const session = { inTransaction: () => true, withTransaction: async (callback: () => Promise<void>) => callback(), endSession: async () => {} };
    const db = { startSession: async () => session, collection: () => ({ updateOne: async () => ({ matchedCount: 1 }), findOne: async () => ({ generation: 0 }) }) };
    service = new NutritionService({ findOneAndUpdate, db } as never, { getNutrients: vi.fn(async (id: number) => id === 171477 ? {
      fdcId: id, description: 'Chicken breast, raw', kcal_per_100g: 120, protein_g_per_100g: 22.5, carbs_g_per_100g: 0, fat_g_per_100g: 2.6,
    } : { fdcId: id, description: 'cooked chicken', kcal_per_100g: 165, protein_g_per_100g: 31, carbs_g_per_100g: 0, fat_g_per_100g: 3.6 }) } as never);
  });

  /** The meal objects that were pushed, in order. */
  const pushedMeals = () => findOneAndUpdate.mock.calls[0][1].$push.meals.$each as Record<string, unknown>[];

  const payload = (overrides: Partial<MealFromScanDto> = {}): MealFromScanDto =>
    ({
      meal: 'Lunch',
      date: '2026-01-05',
      items: [
        {
          food_name: 'chicken breast',
          found: true,
          fdc_id: 171477,
          description: 'Chicken breast, raw',
          kcal: 180,
          protein_g: 33.8,
          carbs_g: 0,
          fat_g: 3.9,
          est_weight_g: 150,
          confidence: 0.92,
        },
      ],
      ...overrides,
    }) as MealFromScanDto;

  it('writes one meal row per priced item', async () => {
    await service.addMealsFromScan(USER_ID, payload({
      items: [
        ...payload().items,
        { food_name: 'white rice', found: true, fdc_id: 168878, est_weight_g: 100, kcal: 260, protein_g: 4.8, carbs_g: 56.4, fat_g: 0.6 },
      ],
    }));

    expect(pushedMeals()).toHaveLength(2);
  });

  it('maps the scan fields onto the meal entry', async () => {
    await service.addMealsFromScan(USER_ID, payload());

    expect(pushedMeals()[0]).toMatchObject({
      name: 'chicken breast',
      meal: 'Lunch',
      calories: 180,
      protein: 33.8,
      carbs: 0,
      fat: 3.9,
      detail: 'Chicken breast, raw',
      date: '2026-01-05',
      source: 'Scanned',
    });
  });

  it('recalculates corrected weights from per-100g values on save', async () => {
    await service.addMealsFromScan(USER_ID, payload({ items: [{
      food_name: 'cooked chicken', found: true, fdc_id: 99, est_weight_g: 120,
      kcal: 999, protein_g: 999, carbs_g: 999, fat_g: 999,
      per_100g: { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
    }] }));
    expect(pushedMeals()[0]).toMatchObject({ calories: 198, protein: 37.2, carbs: 0, fat: 4.3 });
  });

  it('fails closed if a matched item lacks a verifiable record or weight', async () => {
    await expect(service.addMealsFromScan(USER_ID, payload({ items: [{ food_name: 'rice', found: true, est_weight_g: 100, kcal: 1, protein_g: 1, carbs_g: 1, fat_g: 1 }] }))).rejects.toThrow(BadRequestException);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not save any items if USDA verification fails', async () => {
    const failing = new NutritionService({ findOneAndUpdate } as never, { getNutrients: vi.fn().mockRejectedValue(new Error('unavailable')) } as never);
    await expect(failing.addMealsFromScan(USER_ID, payload())).rejects.toThrow();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('keeps the scan provenance so an entry can be traced back', async () => {
    await service.addMealsFromScan(USER_ID, payload());

    expect(pushedMeals()[0]).toMatchObject({
      fdcId: 171477,
      confidence: 0.92,
      estWeightG: 150,
    });
  });

  it('omits provenance fields the scan did not provide', async () => {
    // Storing an explicit null would make "unknown" indistinguishable from a
    // measured zero in the saved document.
    await service.addMealsFromScan(USER_ID, payload({
      items: [{ food_name: 'mystery paste', found: false, est_weight_g: 50, kcal: 10, protein_g: 1, carbs_g: 1, fat_g: 0 }],
    }));

    const meal = pushedMeals()[0];
    expect(meal).not.toHaveProperty('fdcId');
    expect(meal).not.toHaveProperty('confidence');
    expect(meal.estWeightG).toBe(50);
  });

  it('gives every row a distinct id', async () => {
    await service.addMealsFromScan(USER_ID, payload({
      items: [
        { food_name: 'chicken breast', found: true, fdc_id: 171477, est_weight_g: 150, kcal: 180, protein_g: 33, carbs_g: 0, fat_g: 4 },
        { food_name: 'white rice', found: true, fdc_id: 99, est_weight_g: 100, kcal: 260, protein_g: 5, carbs_g: 56, fat_g: 1 },
      ],
    }));

    const [a, b] = pushedMeals();
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it('stores each unmatched item with unavailable nutrition instead of zero', async () => {
    await service.addMealsFromScan(USER_ID, payload({
      items: [
        ...payload().items,
        { food_name: 'mystery paste', found: false, est_weight_g: 50, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      ],
    }));

    expect(pushedMeals()).toHaveLength(2);
    expect(pushedMeals()[0].name).toBe('chicken breast');
    expect(pushedMeals()[1]).toMatchObject({ name: 'mystery paste', calories: null, protein: null, carbs: null, fat: null });
  });

  it('rejects an empty selection', async () => {
    await expect(
      service.addMealsFromScan(USER_ID, payload({
        items: [],
      }))
    ).rejects.toThrow(BadRequestException);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('defaults the date to today when the client omits it', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await service.addMealsFromScan(USER_ID, { meal: 'Dinner', items: payload().items } as MealFromScanDto);

    expect(pushedMeals()[0].date).toBe(today);
  });

  it('upserts so the first scan of a new user creates the document', async () => {
    await service.addMealsFromScan(USER_ID, payload());

    expect(findOneAndUpdate.mock.calls[0][2]).toMatchObject({ upsert: true, returnDocument: 'after' });
  });

  it('scopes the write to the requesting user', async () => {
    await service.addMealsFromScan(USER_ID, payload());

    expect(String(findOneAndUpdate.mock.calls[0][0].userId)).toBe(USER_ID);
  });
});
