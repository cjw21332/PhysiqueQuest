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
  unitName?: string;
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
  foodPortions?: { gramWeight?: number; modifier?: string; amount?: number }[];
}

export interface NutrientResult {
  fdcId: number;
  description: string;
  dataType: string;
  kcal_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  servingSizeG?: number;
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

  private search(query: string, pageSize: number, dataTypes: readonly string[]) {
    const cfg = this.config.value;
    // USDA requires the key as a query parameter, so this URL is a secret in
    // transit. It is never logged; safeUrl() strips the query string.
    const url = new URL(`${cfg.usda.base.replace(/\/$/, '')}/foods/search`);
    url.search = new URLSearchParams({
      api_key: cfg.usda.apiKey,
    }).toString();
    // USDA's JSON search avoids intermittent nginx 400s observed on GET searches.
    return this.http.fetchJson<{ foods?: UsdaFood[] }>(url.toString(), {
      upstream: 'nutrition database',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, pageSize, dataType: dataTypes }),
      retryServerErrors: true,
    });
  }

  private async searchFood(query: string): Promise<UsdaFood | undefined> {
    this.requireConfigured();
    const key = query.toLowerCase();
    const cached = searchCache.get(key);
    if (cached) return cached;

    const data = await this.search(query, 10, ['Foundation', 'SR Legacy']);

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
    const data = await this.http.fetchJson<UsdaFood>(url, {
      upstream: 'nutrition database',
      retryServerErrors: true,
    });

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
      servingSizeG: data.servingSizeUnit?.toLowerCase() === 'g' && data.servingSize && data.servingSize > 0
        ? data.servingSize
        : data.foodPortions?.find((portion) => typeof portion.gramWeight === 'number' && portion.gramWeight > 0)?.gramWeight,
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
    const data = await this.search(query, 25, ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded']);

    const foods = (data.foods || []).filter((food) => food.fdcId && food.description);
    const nonBranded = foods.filter((food) => food.dataType !== 'Branded');
    // Prefer neutral ingredient records when the query has enough of them.
    // This keeps searches such as "egg" from filling the list with product
    // names like Just Egg while retaining branded choices for niche foods.
    const pool = nonBranded.length >= 3 ? nonBranded : foods;
    const queryTokens = foodSearchTokens(query);
    const ranked = pool
      .map((food) => ({ food, score: foodSearchScore(food, queryTokens) }))
      .sort((left, right) => right.score - left.score);

    const candidates: FoodCandidate[] = [];
    const seenNames = new Set<string>();
    for (const { food } of ranked) {
      const normalized = normalizeFoodDescription(food.description);
      if (seenNames.has(normalized)) continue;
      const tokens = foodSearchTokens(food.description);
      // Drop near-identical USDA records, but keep meaningful varieties such
      // as egg white, yolk, scrambled, or hard-boiled.
      const redundant = candidates.some((candidate) => tokenSimilarity(tokens, foodSearchTokens(candidate.description)) >= 0.82);
      if (redundant) continue;
      seenNames.add(normalized);
      candidates.push({ fdc_id: food.fdcId, description: food.description, data_type: food.dataType });
      if (candidates.length >= pageSize) break;
    }
    return candidates;
  }
}

const FOOD_SEARCH_STOP_WORDS = new Set(['and', 'or', 'with', 'of', 'the', 'fresh', 'food', 'foods']);

function foodSearchTokens(value: string): string[] {
  return normalizeFoodDescription(value)
    .split(' ')
    .filter((token) => token && !FOOD_SEARCH_STOP_WORDS.has(token))
    .map((token) => token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token);
}

function normalizeFoodDescription(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function foodSearchScore(food: UsdaFood, queryTokens: string[]): number {
  const description = normalizeFoodDescription(food.description);
  const tokens = new Set(foodSearchTokens(description));
  const matched = queryTokens.filter((token) => tokens.has(token) || [...tokens].some((candidate) => candidate.startsWith(token)));
  const dataTypeScore = food.dataType === 'Foundation' ? 40
    : food.dataType === 'SR Legacy' ? 32
      : food.dataType.startsWith('Survey') ? 20
        : -30;
  return dataTypeScore + matched.length * 24 + (matched.length === queryTokens.length ? 20 : 0)
    + (description.startsWith(queryTokens.join(' ')) ? 12 : 0);
}

function tokenSimilarity(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  const union = new Set([...a, ...b]);
  if (!union.size) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / union.size;
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
  const energy = (id: number) => {
    const n = nu.find((x) => (x.nutrient?.id ?? x.nutrientId ?? Number(x.nutrientNumber)) === id && (!((x.nutrient?.unitName ?? x.unitName)) || (x.nutrient?.unitName ?? x.unitName)?.toLowerCase() === 'kcal'));
    const value = n?.value ?? n?.amount;
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
  };
  let kcal = energy(2048) ?? energy(2047) ?? energy(NUTRIENT_IDS.kcal);
  let protein = get(NUTRIENT_IDS.protein);
  let carbs = get(NUTRIENT_IDS.carbs);
  let fat = get(NUTRIENT_IDS.fat);
  let source: 'foodNutrients' | 'labelNutrients' = 'foodNutrients';

  // Branded foods often omit foodNutrients and expose labelNutrients instead.
  if ((kcal ?? 0) + protein + carbs + fat === 0 && data.labelNutrients && data.servingSize && data.servingSize > 0 && data.servingSizeUnit?.toLowerCase() === 'g') {
    const ln = data.labelNutrients;
    kcal = ln.calories?.value;
    protein = ln.protein?.value ?? 0;
    carbs = ln.carbohydrates?.value ?? 0;
    fat = ln.fat?.value ?? 0;
    source = 'labelNutrients';
  }

  if (kcal === undefined && data.labelNutrients?.calories?.value !== undefined && data.servingSize && data.servingSize > 0 && data.servingSizeUnit?.toLowerCase() === 'g') {
    kcal = data.labelNutrients.calories.value * 100 / data.servingSize;
  }

  // labelNutrients are per serving; normalize to per-100g when serving is in grams.
  if (source === 'labelNutrients' && data.servingSize && data.servingSizeUnit?.toLowerCase() === 'g') {
    const factor = 100 / data.servingSize;
    if (kcal !== undefined) kcal *= factor;
    protein *= factor;
    carbs *= factor;
    fat *= factor;
  }

  if (kcal === undefined || !Number.isFinite(kcal) || kcal < 0) throw serviceUnavailable('Calories are unavailable for this food. Please choose another result.');
  return { kcal, protein, carbs, fat };
}
