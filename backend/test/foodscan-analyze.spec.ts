import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { AppError, ErrorCode } from '../src/common/foodscan/errors.js';
import { GeminiService } from '../src/foodscan/services/gemini.service.js';
import { UsdaService } from '../src/foodscan/services/usda.service.js';
import { buildScannerApp, server } from './foodscan.harness.js';
import { JSON_HEADERS, TINY_PNG_BASE64 } from './foodscan.fixtures.js';

/**
 * The scan pipeline end to end, with both providers mocked. These assert the
 * response contract and the macro arithmetic, not the providers themselves.
 */
describe('POST /nutrition/scan', () => {
  let app: INestApplication;
  let detectFoods: ReturnType<typeof vi.spyOn>;
  let lookupFood: ReturnType<typeof vi.spyOn>;

  const CHICKEN = {
    fdcId: 171477,
    description: 'Chicken breast, raw',
    dataType: 'Foundation',
    kcal_per_100g: 120,
    protein_g_per_100g: 22.5,
    carbs_g_per_100g: 0,
    fat_g_per_100g: 2.6,
  };

  const RICE = {
    fdcId: 168878,
    description: 'Rice, white, cooked',
    dataType: 'Foundation',
    kcal_per_100g: 130,
    protein_g_per_100g: 2.4,
    carbs_g_per_100g: 28.2,
    fat_g_per_100g: 0.3,
  };

  beforeEach(async () => {
    app = await buildScannerApp(
      { GEMINI_API_KEY: 'test-gemini', USDA_API_KEY: 'test-usda' },
      { auth: false }
    );
    detectFoods = vi.spyOn(app.get(GeminiService), 'detectFoods');
    lookupFood = vi.spyOn(app.get(UsdaService), 'lookupFood');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
  });

  const post = (body: unknown = { image: TINY_PNG_BASE64 }) =>
    server(app).post('/nutrition/scan').set(JSON_HEADERS).send(body as object);

  it('returns detected items with scaled macros and totals', async () => {
    detectFoods.mockResolvedValue([
      { food_name: 'chicken breast', est_weight_g: 150, confidence: 0.92 },
      { food_name: 'white rice', est_weight_g: 200, confidence: 0.85 },
    ]);
    lookupFood.mockImplementation(async (name: string) => (name === 'chicken breast' ? CHICKEN : RICE));

    const res = await post();

    expect(res.status).toBe(200);
    expect(res.body.request_id).toBeTruthy();
    expect(res.body.degraded).toBe(false);
    expect(res.body.unmatched).toEqual([]);
    expect(res.body.items).toHaveLength(2);

    const chicken = res.body.items.find((i: { food_name: string }) => i.food_name === 'chicken breast');
    expect(chicken).toMatchObject({
      found: true,
      fdc_id: 171477,
      est_weight_g: 150,
      confidence: 0.92,
      kcal: 180, // 120 * 1.5
      protein_g: 33.8, // 22.5 * 1.5 -> 33.75 rounded
      carbs_g: 0,
      fat_g: 3.9, // 2.6 * 1.5
    });
    expect(chicken.per_100g).toEqual({ kcal: 120, protein_g: 22.5, carbs_g: 0, fat_g: 2.6 });

    // totals = 180 + 260 kcal
    expect(res.body.totals.kcal).toBe(440);
    expect(res.body.totals.carbs_g).toBe(56.4); // 28.2 * 2
  });

  it('uses snake_case field names throughout', async () => {
    detectFoods.mockResolvedValue([{ food_name: 'chicken breast', est_weight_g: 100, confidence: 0.9 }]);
    lookupFood.mockResolvedValue(CHICKEN);

    const res = await post();
    const item = res.body.items[0];

    expect(item).toHaveProperty('fdc_id');
    expect(item).toHaveProperty('per_100g');
    expect(item).not.toHaveProperty('fdcId');
    expect(item).not.toHaveProperty('per100');
  });

  it('marks a food with no nutrition match as unmatched', async () => {
    detectFoods.mockResolvedValue([{ food_name: 'mystery paste', est_weight_g: 50, confidence: 0.4 }]);
    lookupFood.mockResolvedValue(undefined);

    const res = await post();

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(false);
    expect(res.body.unmatched).toEqual(['mystery paste']);
    expect(res.body.items[0]).toMatchObject({ found: false, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
    expect(res.body.items[0].fdc_id).toBeUndefined();
    expect(res.body.totals.kcal).toBe(0);
  });

  it('degrades gracefully when one nutrition lookup fails', async () => {
    detectFoods.mockResolvedValue([
      { food_name: 'chicken breast', est_weight_g: 150, confidence: 0.9 },
      { food_name: 'white rice', est_weight_g: 200, confidence: 0.8 },
    ]);
    lookupFood.mockImplementation(async (name: string) => {
      if (name === 'chicken breast') throw new Error('upstream exploded');
      return RICE;
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(true);
    expect(res.body.unmatched).toEqual(['chicken breast']);
    expect(res.body.items.find((i: { food_name: string }) => i.food_name === 'white rice').found).toBe(true);
  });

  it('treats an image with no recognisable food as a success', async () => {
    detectFoods.mockResolvedValue([]);

    const res = await post();

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.unmatched).toEqual([]);
    expect(res.body.totals).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
    expect(res.body.degraded).toBe(false);
  });

  describe('provider failures map to the documented status codes', () => {
    it('returns 503 when the service is not configured for the model', async () => {
      detectFoods.mockRejectedValue(
        new AppError(ErrorCode.SERVICE_UNAVAILABLE, 'Vision model is not configured on this service', {
          details: { missing_env: 'GEMINI_API_KEY' },
        })
      );

      const res = await post();
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('returns 502 when the model provider fails', async () => {
      detectFoods.mockRejectedValue(
        new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, 'vision model is currently unavailable', {
          details: { upstream: 'vision model' },
        })
      );

      const res = await post();
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    });

    it('returns 429, not 502, when the provider refuses on quota', async () => {
      // Regression guard: this used to surface as 502, which reads as a server
      // fault and invites an immediate retry that fails identically. A client
      // can only back off if the status distinguishes the two.
      detectFoods.mockRejectedValue(
        new AppError(ErrorCode.PROVIDER_RATE_LIMITED, 'The food scanner is busy right now. Wait a moment, then try again.', {
          details: { upstream: 'gemini' },
        })
      );

      const res = await post();
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('PROVIDER_RATE_LIMITED');
    });

    it('returns 504 when the model provider times out', async () => {
      detectFoods.mockRejectedValue(
        new AppError(ErrorCode.UPSTREAM_TIMEOUT, 'vision model did not respond in time', {
          details: { upstream: 'vision model' },
        })
      );

      const res = await post();
      expect(res.status).toBe(504);
      expect(res.body.error.code).toBe('UPSTREAM_TIMEOUT');
    });

    it('returns 500 and no provider detail for an unexpected failure', async () => {
      detectFoods.mockRejectedValue(new Error('connection to 10.0.3.7:5432 refused, key=AIzaSECRET'));

      const res = await post();
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL');
      expect(res.body.error.message).toBe('Internal server error');
      // The upstream text, including the embedded key and host, must not leak.
      expect(JSON.stringify(res.body)).not.toContain('AIzaSECRET');
      expect(JSON.stringify(res.body)).not.toContain('10.0.3.7');
    });
  });

  it('passes the detected mime type from image bytes, not the caller claim', async () => {
    detectFoods.mockResolvedValue([]);
    // The bytes are a PNG while the caller claims JPEG.
    const res = await post({ image: TINY_PNG_BASE64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(detectFoods).toHaveBeenCalledWith(expect.any(String), 'image/png');
  });

  it('accepts a data: URL prefix and normalises it', async () => {
    detectFoods.mockResolvedValue([]);
    const res = await post({ image: `data:image/png;base64,${TINY_PNG_BASE64}` });

    expect(res.status).toBe(200);
    expect(detectFoods).toHaveBeenCalledWith(TINY_PNG_BASE64, 'image/png');
  });

  it('validates the body before spending a provider call', async () => {
    const res = await post({ image: '!!!not-base64!!!' });
    expect(res.status).toBe(400);
    expect(detectFoods).not.toHaveBeenCalled();
  });

  it('does not send an image URL to the provider', async () => {
    const res = await post({ image: TINY_PNG_BASE64, imageUrl: 'http://169.254.169.254/' });
    expect(res.status).toBe(400);
    expect(detectFoods).not.toHaveBeenCalled();
  });
});
