import { Injectable } from '@nestjs/common';
import { FoodScanConfigService } from '../../common/foodscan/foodscan-config.js';
import { notFound, serviceUnavailable } from '../../common/foodscan/errors.js';
import { HttpService } from '../../common/foodscan/http.service.js';
import type { FoodCandidate } from '../foodscan.schemas.js';

const NUTRIENT_IDS = {
  kcal: 1008,
  protein: 1003,
  carbs: 1005,
  fat: 1004,
};

interface UsdaNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  nutrient?: { id?: number; number?: string; name?: string; unitName?: string };
  value?: number;
  amount?: number;
}

interface UsdaFood {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients?: UsdaNutrient[];
  labelNutrients?: Record<string, { value: number }>;
  servingSize?: number;
  servingSizeUnit?: string;
}

export interface NutrientResult {
  fdcId: number;
  description: string;
  dataType: string;
  kcal_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
}

/**
 * Bounded TTL cache.
 *
 * A plain Map with no eviction lets any caller grow it without limit by sending
 * unique search terms. This caps both entry count and lifetime.
 */
class BoundedCache<T> {
  private readonly map = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number
  ) {}

  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency for the LRU eviction below.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.map.delete(oldest.value);
    }
  }

  get size(): number {
    return this.map.size;
  }
}

// USDA allows roughly 1000 requests per hour per IP; a one-hour TTL keeps the
// cache useful without pushing a steady caller over that ceiling.
const detailCache = new BoundedCache<NutrientResult>(2000, 60 * 60 * 1000);
const searchCache = new BoundedCache<UsdaFood>(1000, 60 * 60 * 1000);

@Injectable()
export class UsdaService {
  constructor(
    private readonly config: FoodScanConfigService,
    private readonly http: HttpService,
  ) {}

  private requireConfigured(): void {
    if (!this.config.value.usda.configured) {
      throw serviceUnavailable('Nutrition data source is not configured on this service', {
        missing_env: 'USDA_API_KEY',
      });
    }
  }

  private searchUrl(query: string, pageSize: number, dataTypes: string): string {
    const cfg = this.config.value;
    // USDA requires the key as a query parameter, so this URL is a secret in
    // transit. It is never logged; safeUrl() strips the query string.
    return (
      `${cfg.usda.base}/foods/search?api_key=${encodeURIComponent(cfg.usda.apiKey)}` +
      `&query=${encodeURIComponent(query)}&pageSize=${pageSize}` +
      `&dataType=${dataTypes}`
    );
  }

  private async searchFood(query: string): Promise<UsdaFood | undefined> {
    this.requireConfigured();
    const key = query.toLowerCase();
    const cached = searchCache.get(key);
    if (cached) return cached;

    const data = await this.http.fetchJson<{ foods?: UsdaFood[] }>(
      this.searchUrl(query, 10, 'Foundation,SR%20Legacy'),
      { upstream: 'nutrition database' }
    );

    const foods = (data.foods || []).filter((f) => f.fdcId && (f.foodNutrients?.length ?? 0) > 0);
    foods.sort((a, b) => rankDataType(b.dataType) - rankDataType(a.dataType));
    const best = foods[0];
    if (best) searchCache.set(key, best);
    return best;
  }

  async getNutrients(fdcId: number): Promise<NutrientResult> {
    this.requireConfigured();
    const cached = detailCache.get(String(fdcId));
    if (cached) return cached;

    const cfg = this.config.value;
    const url = `${cfg.usda.base}/food/${fdcId}?api_key=${encodeURIComponent(cfg.usda.apiKey)}`;
    const data = await this.http.fetchJson<UsdaFood>(url, { upstream: 'nutrition database' });

    if (!data?.fdcId) throw notFound('No food record exists for that identifier');

    const { kcal, protein, carbs, fat } = parseNutrients(data);
    const result: NutrientResult = {
      fdcId: data.fdcId,
      description: data.description,
      dataType: data.dataType,
      kcal_per_100g: kcal,
      protein_g_per_100g: protein,
      carbs_g_per_100g: carbs,
      fat_g_per_100g: fat,
    };
    detailCache.set(String(fdcId), result);
    return result;
  }

  async lookupFood(foodName: string): Promise<NutrientResult | undefined> {
    const food = await this.searchFood(foodName);
    if (!food) return undefined;

    const detail = await this.getNutrients(food.fdcId);
    if (detail) return detail;

    // The detail endpoint can fail while the search payload already carried
    // nutrients, so fall back to parsing the search result.
    const { kcal, protein, carbs, fat } = parseNutrients(food);
    return {
      fdcId: food.fdcId,
      description: food.description,
      dataType: food.dataType,
      kcal_per_100g: kcal,
      protein_g_per_100g: protein,
      carbs_g_per_100g: carbs,
      fat_g_per_100g: fat,
    };
  }

  async searchCandidates(query: string, limit = 8): Promise<FoodCandidate[]> {
    this.requireConfigured();
    // Bounded independently of caller input.
    const pageSize = Math.max(1, Math.min(25, Math.trunc(limit)));
    const data = await this.http.fetchJson<{ foods?: UsdaFood[] }>(
      this.searchUrl(query, pageSize, 'Foundation,SR%20Legacy,Branded'),
      { upstream: 'nutrition database' }
    );

    return (data.foods || [])
      .filter((f) => f.fdcId)
      .slice(0, pageSize)
      .map((f) => ({ fdc_id: f.fdcId, description: f.description, data_type: f.dataType }));
  }
}

function rankDataType(t: string): number {
  if (t === 'Foundation') return 3;
  if (t === 'SR Legacy') return 2;
  if (t.startsWith('Survey')) return 1;
  return 0;
}

function parseNutrients(data: UsdaFood): {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  const nu = data.foodNutrients || [];
  const get = (id: number) => {
    const n = nu.find((x) => (x.nutrient?.id ?? x.nutrientId ?? Number(x.nutrientNumber)) === id);
    return n ? (n.value ?? (n as { amount?: number }).amount ?? 0) : 0;
  };
  let kcal = get(NUTRIENT_IDS.kcal);
  let protein = get(NUTRIENT_IDS.protein);
  let carbs = get(NUTRIENT_IDS.carbs);
  let fat = get(NUTRIENT_IDS.fat);
  let source: 'foodNutrients' | 'labelNutrients' = 'foodNutrients';

  // Branded foods often omit foodNutrients and expose labelNutrients instead.
  if (kcal + protein + carbs + fat === 0 && data.labelNutrients) {
    const ln = data.labelNutrients;
    kcal = ln.calories?.value ?? 0;
    protein = ln.protein?.value ?? 0;
    carbs = ln.carbohydrates?.value ?? 0;
    fat = ln.fat?.value ?? 0;
    source = 'labelNutrients';
  }

  // labelNutrients are per serving; normalize to per-100g when serving is in grams.
  if (source === 'labelNutrients' && data.servingSize && data.servingSizeUnit === 'g') {
    const factor = 100 / data.servingSize;
    kcal *= factor;
    protein *= factor;
    carbs *= factor;
    fat *= factor;
  }

  return { kcal, protein, carbs, fat };
}