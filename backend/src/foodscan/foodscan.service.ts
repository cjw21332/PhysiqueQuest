import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { FoodScanConfigService } from '../common/foodscan/foodscan-config.js';
import { AppError, ErrorCode } from '../common/foodscan/errors.js';
import { currentDeadline, remainingMs, runWithDeadline } from '../common/foodscan/deadline-context.js';
import { mapConcurrent } from '../common/foodscan/http.service.js';
import { AI_VISION_PROVIDER, type VisionProvider, type DetectedItem } from './services/vision-provider.js';
import { UsdaService } from './services/usda.service.js';
import { foodSearchTerms } from './services/food-synonyms.js';
import { researchedRecipeByName } from './services/researched-recipes.js';
import { researchNutrition } from './services/web-nutrition.js';
import { issueEvidenceProof } from './services/evidence-proof.js';
import { attributeEvidence } from './services/evidence-attribution.js';
import type { TokenUsage } from './foodscan-usage.service.js';
import {
  analyzeRequestSchema,
  analyzeResponseSchema,
  FoodScanSchemasService,
  ImagePayloadError,
  type AnalyzedItem,
  type AnalyzeResponse,
  type FoodCandidate,
  type FoodDetailResponse,
  type Macros,
} from './foodscan.schemas.js';

/** Upper bound on concurrent USDA lookups for a single image. */
const USDA_CONCURRENCY = 4;

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
function scale(value: number | null, factor: number): number | null {
  return value === null ? null : round(value * factor);
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w+/g, (c) => c.charAt(0).toUpperCase() + c.slice(1));
}

function zeroMacros(): Macros {
  return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
}

/** Maps an image validation failure onto the right status code. */
function imageErrorToAppError(err: ImagePayloadError): AppError {
  switch (err.reason) {
    case 'too_large':
      return new AppError(ErrorCode.PAYLOAD_TOO_LARGE, err.message, { details: err.details });
    case 'unrecognized_format':
    case 'image/gif':
    case 'image/svg+xml':
      return new AppError(ErrorCode.UNSUPPORTED_MEDIA_TYPE, err.message, {
        details: { reason: err.reason },
      });
    default:
      if (err.reason.startsWith('image/')) {
        return new AppError(ErrorCode.UNSUPPORTED_MEDIA_TYPE, err.message, {
          details: { reason: err.reason },
        });
      }
      return new AppError(ErrorCode.INVALID_REQUEST, err.message);
  }
}

@Injectable()
export class FoodScanService {
  private readonly logger = new Logger(FoodScanService.name);

  constructor(
    private readonly config: FoodScanConfigService,
    private readonly schemas: FoodScanSchemasService,
    @Inject(AI_VISION_PROVIDER) private readonly vision: VisionProvider,
    private readonly usda: UsdaService,
  ) {}

  /**
   * Identifies the food in an image and prices each detected item.
   *
   * `rawBody` is the unparsed request body. It is validated here rather than by
   * a DTO so Zod stays the single authority for the contract; the body is typed
   * `unknown` at the controller so the global ValidationPipe skips it.
   */
  async analyze(rawBody: unknown, requestId: string, onUsage?: (usage: TokenUsage | null) => void, userId?: string): Promise<AnalyzeResponse> {
    const cfg = this.config.value;

    // Validation runs before any credential or provider is touched, so a
    // malformed request costs nothing.
    const body = analyzeRequestSchema.parse(rawBody);

    let image;
    try {
      image = this.schemas.normalizeImagePayload(body.image, body.mimeType);
    } catch (err) {
      if (err instanceof ImagePayloadError) throw imageErrorToAppError(err);
      throw err;
    }

    const visionStarted = Date.now();
    let detected: DetectedItem[];
    try {
      detected = body.description?.trim() ? await this.vision.detectFoods(image.base64, image.mimeType, onUsage, body.description.trim()) : await this.vision.detectFoods(image.base64, image.mimeType, onUsage);
      this.logger.log(`vision_completed request_id=${requestId} duration_ms=${Date.now() - visionStarted}`);
    } catch (error) {
      this.logger.warn(`vision_failed request_id=${requestId} duration_ms=${Date.now() - visionStarted} category=${error instanceof AppError ? error.code : 'unknown'}`);
      throw error;
    }

    if (detected.length === 0) {
      // A valid image with no recognisable food is a successful outcome.
      const empty: AnalyzeResponse = {
        request_id: requestId,
        items: [],
        unmatched: [],
        totals: zeroMacros(),
        degraded: false,
      };
      return analyzeResponseSchema.parse(empty);
    }

    // Bounded concurrency instead of a serial await loop, which made an
    // eight-item photo cost sixteen sequential round trips.
    let degraded = false;
    const deadline = currentDeadline();
    // Return recognized foods promptly even if a nutrition provider is slow.
    const nutritionBudget = Math.max(0, Math.min(10_000, remainingMs(deadline) - 1500));
    const nutritionAbort = new AbortController();
    let nutritionTimer: ReturnType<typeof setTimeout> | undefined;
    const results: Array<Awaited<ReturnType<UsdaService['lookupFood']>> | Awaited<ReturnType<typeof researchNutrition>> | ReturnType<typeof researchedRecipeByName>> = new Array(detected.length);
    const lookup = runWithDeadline({ signal: nutritionAbort.signal, deadlineAt: Date.now() + nutritionBudget }, () => mapConcurrent(detected.map((food, index) => ({ food, index })), USDA_CONCURRENCY, async ({ food: d, index }) => {
      const result = await (async () => {
      if (nutritionAbort.signal.aborted) return undefined;
      try {
        const reviewed = researchedRecipeByName(d.food_name, [...(d.searchTerms ?? []), ...(d.localName ? [d.localName] : [])]);
        if (reviewed) return reviewed;
        const genericTokens = new Set(['chicken', 'turkey', 'shrimp', 'prawns', 'seafood', 'vegetable', 'vegetables', 'cooked', 'fried', 'grilled', 'stewed', 'soup', 'with']);
        const nameTokens = foodSearchTerms(d.food_name)[0].split(' ').filter(token => token.length >= 5 && !genericTokens.has(token));
        // A generic ingredient alias for a mixed dish is not a reliable match
        // for the complete dish. Preserve uncertainty instead of substituting it.
        const aliases = [...(d.searchTerms ?? []), ...(d.localName ? [d.localName] : [])].filter(term => !d.isComposite || nameTokens.some(token => foodSearchTerms(term).some(alias => alias.split(' ').includes(token))));
        let webLookup: ReturnType<typeof researchNutrition> | undefined;
        for (const term of [...new Set([d.food_name, ...aliases].flatMap(foodSearchTerms))]) {
          if (nutritionAbort.signal.aborted) return undefined;
          try {
            const result = await this.usda.lookupFood(term, false);
            if (result) {
              const incomplete = [result.kcal_per_100g, result.protein_g_per_100g, result.carbs_g_per_100g, result.fat_g_per_100g].some(value => value === null);
              if (incomplete && userId && !nutritionAbort.signal.aborted) {
                return await (webLookup ?? researchNutrition(d.food_name, userId, onUsage)) ?? result;
              }
              return result;
            }
          } catch {
            // A failed search term should not prevent another name for the same food from matching.
            degraded = true;
            this.logger.warn({ event: 'nutrition_lookup_failed', request_id: requestId });
          }
          if (!webLookup && userId && !nutritionAbort.signal.aborted) webLookup = researchNutrition(d.food_name, userId, onUsage);
        }
        return webLookup ? await webLookup : undefined;
      } catch {
        // A single failed nutrition lookup must not fail the whole analysis:
        // the caller can still show the detected items.
        degraded = true;
        this.logger.warn({ event: 'nutrition_lookup_failed', request_id: requestId });
        return undefined;
      }
      })();
      if (!nutritionAbort.signal.aborted) results[index] = result;
      return result;
    }));
    if (Number.isFinite(nutritionBudget)) {
      const completed = await Promise.race([
        lookup.then(() => true),
        new Promise<false>(resolve => { nutritionTimer = setTimeout(() => { nutritionAbort.abort(); resolve(false); }, nutritionBudget); }),
      ]);
      if (!completed) degraded = true;
    } else {
      (await lookup).forEach((value, index) => { results[index] = value; });
    }
    if (nutritionTimer) clearTimeout(nutritionTimer);

    const items: AnalyzedItem[] = [];
    const unmatched: string[] = [];

    const scan = { id: randomUUID(), image: createHash('sha256').update(image.base64).digest('hex'), analysis: createHash('sha256').update(JSON.stringify(detected)).digest('hex') };
    detected.forEach((d, i) => {
      const nut = results[i];
      const evidence = attributeEvidence(d, body.description);
      const evidence_ref = userId ? issueEvidenceProof(userId, d.food_name, d.est_weight_g, evidence, scan) : undefined;
      if (!nut) {
        unmatched.push(d.food_name);
        items.push({
          food_name: d.food_name,
          est_weight_g: d.est_weight_g,
          confidence: d.confidence,
          localName: d.localName, searchTerms: d.searchTerms, isComposite: d.isComposite, portionDescription: d.portionDescription,
          portion_method: 'visual_estimate', portion_confidence: null, region_confidence: null, weight_min_g: null, weight_max_g: null,
          found: false,
          evidence,
          ...(evidence_ref ? { evidence_ref } : {}),
          kcal: null, protein_g: null, carbs_g: null, fat_g: null,
        });
        return;
      }

      const factor = d.est_weight_g / 100;
      const macros = {
        kcal: scale(nut.kcal_per_100g, factor),
        protein_g: scale(nut.protein_g_per_100g, factor),
        carbs_g: scale(nut.carbs_g_per_100g, factor),
        fat_g: scale(nut.fat_g_per_100g, factor),
      };

      items.push({
        // Preserve the model's exact item label: scan results are sent back to
        // the meal endpoint verbatim, so changing this field breaks the contract.
        food_name: d.food_name,
        est_weight_g: d.est_weight_g,
        confidence: d.confidence,
        localName: d.localName, searchTerms: d.searchTerms, isComposite: d.isComposite, portionDescription: d.portionDescription,
        portion_method: 'visual_estimate', portion_confidence: null, region_confidence: null, weight_min_g: null, weight_max_g: null,
        found: true,
        evidence,
        ...(evidence_ref ? { evidence_ref } : {}),
        ...('fdcId' in nut ? { fdc_id: nut.fdcId } : { nutrition_ref: nut.nutrition_ref, nutrition_source: nut.source, ...('reference_ingredients' in nut && Array.isArray(nut.reference_ingredients) ? { reference_ingredients: nut.reference_ingredients as string[] } : {}) }),
        description: titleCase(nut.description),
        ...macros,
        per_100g: {
          kcal: nut.kcal_per_100g,
          protein_g: nut.protein_g_per_100g,
          carbs_g: nut.carbs_g_per_100g,
          fat_g: nut.fat_g_per_100g,
        },
      });
    });

    const total = (key: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') =>
      items.some(item => item[key] === null) ? null : round(items.reduce((sum, item) => sum + item[key]!, 0));
    const response: AnalyzeResponse = {
      request_id: requestId,
      items,
      unmatched,
      totals: {
        kcal: total('kcal'),
        protein_g: total('protein_g'),
        carbs_g: total('carbs_g'),
        fat_g: total('fat_g'),
      },
      degraded,
    };

    this.logger.log(
      `analysis_completed request_id=${requestId} duration_ms=${Date.now() - visionStarted}`
    );

    return analyzeResponseSchema.parse(response);
  }

  async searchFoods(q: string, requestId: string): Promise<{ request_id: string; candidates: FoodCandidate[] }> {
    const candidates = await this.usda.searchCandidates(foodSearchTerms(q)[0], 8);

    this.logger.log(`food_search request_id=${requestId} result_count=${candidates.length}`);

    return { request_id: requestId, candidates };
  }

  async getFood(fdcId: number, requestId: string): Promise<FoodDetailResponse> {
    const nut = await this.usda.getNutrients(fdcId);

    return {
      request_id: requestId,
      fdc_id: nut.fdcId,
      id: `usda:${nut.fdcId}`,
      source: 'USDA',
      description: nut.description,
      data_type: nut.dataType,
      ...(nut.servingSizeG ? { serving_size_g: nut.servingSizeG } : {}),
      per_100g: {
        kcal: nut.kcal_per_100g,
        protein_g: nut.protein_g_per_100g,
        carbs_g: nut.carbs_g_per_100g,
        fat_g: nut.fat_g_per_100g,
      },
    };
  }
}

export type { DetectedItem };
