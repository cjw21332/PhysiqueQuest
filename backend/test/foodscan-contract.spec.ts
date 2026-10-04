// class-transformer relies on the Reflect metadata API, which Nest normally
// polyfills during bootstrap. This spec exercises the DTOs outside Nest.
import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ErrorCode, statusForCode } from '../src/common/foodscan/errors.js';
import { MealFromScanDto, ScannedMealItemDto } from '../src/nutrition/dto/nutrition.dto.js';
import {
  analyzeResponseSchema,
  foodDetailResponseSchema,
  foodSearchResponseSchema,
} from '../src/foodscan/foodscan.schemas.js';
import { GeminiService } from '../src/foodscan/services/gemini.service.js';
import { UsdaService } from '../src/foodscan/services/usda.service.js';
import { buildScannerApp, server } from './foodscan.harness.js';
import { JSON_HEADERS, TINY_PNG_BASE64 } from './foodscan.fixtures.js';

/**
 * Guards the response contract against the schemas that define it.
 *
 * The standalone service published an OpenAPI document; this backend has none,
 * so these assertions run against the live endpoints instead. That covers the
 * property that actually matters: what a client receives validates against the
 * exported schema, and a scan result can be posted straight back to
 * meals/from-scan without any remapping.
 */
describe('response contract', () => {
  let app: INestApplication;

  const NUTRIENTS = {
    fdcId: 171477,
    description: 'Chicken breast, raw',
    dataType: 'Foundation',
    kcal_per_100g: 120,
    protein_g_per_100g: 22.5,
    carbs_g_per_100g: 0,
    fat_g_per_100g: 2.6,
  };

  beforeEach(async () => {
    app = await buildScannerApp({ GEMINI_API_KEY: 'k', USDA_API_KEY: 'k' }, { auth: false });
    vi.spyOn(app.get(GeminiService), 'detectFoods').mockResolvedValue([
      { food_name: 'chicken breast', est_weight_g: 150, confidence: 0.92 },
      { food_name: 'mystery paste', est_weight_g: 50, confidence: 0.3 },
    ]);
    vi.spyOn(app.get(UsdaService), 'lookupFood').mockImplementation(async (name: string) =>
      name === 'chicken breast' ? NUTRIENTS : undefined
    );
    vi.spyOn(app.get(UsdaService), 'searchCandidates').mockResolvedValue([
      { fdc_id: 171477, description: 'Chicken breast, raw', data_type: 'Foundation' },
    ]);
    vi.spyOn(app.get(UsdaService), 'getNutrients').mockResolvedValue(NUTRIENTS);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
  });

  const scan = () => server(app).post('/nutrition/scan').set(JSON_HEADERS).send({ image: TINY_PNG_BASE64 });

  it('the analyze response validates against analyzeResponseSchema', async () => {
    const res = await scan();
    expect(res.status).toBe(200);

    const parsed = analyzeResponseSchema.safeParse(res.body);
    expect(parsed.success, JSON.stringify(parsed.success ? [] : parsed.error.issues)).toBe(true);
  });

  it('the food search response validates against foodSearchResponseSchema', async () => {
    const res = await server(app).get('/nutrition/foods/search?q=chicken');
    expect(foodSearchResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('the food detail response validates against foodDetailResponseSchema', async () => {
    const res = await server(app).get('/nutrition/foods/171477');
    expect(foodDetailResponseSchema.safeParse(res.body).success).toBe(true);
  });

  describe('scan results feed straight into POST /api/nutrition/meals/from-scan', () => {
    /** The client posts the scan items back verbatim; no renaming is allowed. */
    const validateAsMealFromScan = (items: unknown) => {
      const dto = plainToInstance(MealFromScanDto, { items, meal: 'Lunch' });
      return validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
    };

    it('accepts the items exactly as the scan returned them', async () => {
      const res = await scan();
      const errors = validateAsMealFromScan(res.body.items);
      expect(errors.map((e) => `${e.property}: ${e.constraints}`)).toEqual([]);
    });

    it('carries every field the helper persists', async () => {
      const res = await scan();
      const [chicken] = res.body.items;

      const item = plainToInstance(ScannedMealItemDto, chicken);
      expect(item.food_name).toBe('chicken breast');
      expect(item.fdc_id).toBe(171477);
      expect(item.kcal).toBe(180);
      expect(item.confidence).toBe(0.92);
      expect(item.est_weight_g).toBe(150);
    });

    it('still validates an unmatched item, which the helper then skips', async () => {
      const res = await scan();
      const unmatched = res.body.items.find((i: { found: boolean }) => !i.found);
      expect(validateAsMealFromScan([unmatched])).toEqual([]);
    });
  });

  describe('error codes', () => {
    it('every code maps to a real HTTP status', () => {
      for (const code of Object.values(ErrorCode)) {
        const status = statusForCode(code);
        expect(status, code).toBeGreaterThanOrEqual(400);
        expect(status, code).toBeLessThan(600);
      }
    });

    it('a failure body carries only the documented keys', async () => {
      const res = await server(app).post('/nutrition/scan').set(JSON_HEADERS).send({});

      expect(Object.keys(res.body)).toEqual(['error']);
      expect(Object.keys(res.body.error).sort()).toEqual(
        expect.arrayContaining(['code', 'message', 'request_id'])
      );
      expect(Object.values(ErrorCode)).toContain(res.body.error.code);
    });
  });
});
