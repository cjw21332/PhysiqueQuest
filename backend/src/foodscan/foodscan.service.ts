import { Injectable, Logger } from '@nestjs/common';
import { FoodScanConfigService } from '../common/foodscan/foodscan-config.js';
import { AppError, ErrorCode } from '../common/foodscan/errors.js';
import { mapConcurrent } from '../common/foodscan/http.service.js';
import { GeminiService, type DetectedItem } from './services/gemini.service.js';
import { UsdaService, type NutrientResult } from './services/usda.service.js';
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
    private readonly gemini: GeminiService,
    private readonly usda: UsdaService,
  ) {}

  /**
   * Identifies the food in an image and prices each detected item.
   *
   * `rawBody` is the unparsed request body. It is validated here rather than by
   * a DTO so Zod stays the single authority for the contract; the body is typed
   * `unknown` at the controller so the global ValidationPipe skips it.
   */
  async analyze(rawBody: unknown, requestId: string): Promise<AnalyzeResponse> {
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

    const detected = await this.gemini.detectFoods(image.base64, image.mimeType);

    if (detected.length === 0) {
      // A valid image with no recognisable food is a successful outcome.
      const empty: AnalyzeResponse = {
        request_id: requestId,
        model: cfg.gemini.model,
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
    const results = await mapConcurrent(detected, USDA_CONCURRENCY, async (d) => {
      try {
        return await this.usda.lookupFood(d.food_name);
      } catch (err) {
        // A single failed nutrition lookup must not fail the whole analysis:
        // the caller can still show the detected items.
        degraded = true;
        this.logger.warn(
          `nutrition_lookup_failed request_id=${requestId} food_name=${JSON.stringify(d.food_name)} ` +
            `reason=${JSON.stringify(err instanceof Error ? err.message : String(err))}`
        );
        return undefined;
      }
    });

    const items: AnalyzedItem[] = [];
    const unmatched: string[] = [];
    const totals = zeroMacros();

    detected.forEach((d, i) => {
      const nut: NutrientResult | undefined = results[i];
      if (!nut) {
        unmatched.push(d.food_name);
        items.push({
          food_name: d.food_name,
          est_weight_g: d.est_weight_g,
          confidence: d.confidence,
          found: false,
          ...zeroMacros(),
        });
        return;
      }

      const factor = d.est_weight_g / 100;
      const macros = {
        kcal: round(nut.kcal_per_100g * factor),
        protein_g: round(nut.protein_g_per_100g * factor),
        carbs_g: round(nut.carbs_g_per_100g * factor),
        fat_g: round(nut.fat_g_per_100g * factor),
      };
      totals.kcal += macros.kcal;
      totals.protein_g += macros.protein_g;
      totals.carbs_g += macros.carbs_g;
      totals.fat_g += macros.fat_g;

      items.push({
        food_name: d.food_name,
        est_weight_g: d.est_weight_g,
        confidence: d.confidence,
        found: true,
        fdc_id: nut.fdcId,
        description: nut.description,
        ...macros,
        per_100g: {
          kcal: round(nut.kcal_per_100g),
          protein_g: round(nut.protein_g_per_100g),
          carbs_g: round(nut.carbs_g_per_100g),
          fat_g: round(nut.fat_g_per_100g),
        },
      });
    });

    const response: AnalyzeResponse = {
      request_id: requestId,
      model: cfg.gemini.model,
      items,
      unmatched,
      totals: {
        kcal: round(totals.kcal),
        protein_g: round(totals.protein_g),
        carbs_g: round(totals.carbs_g),
        fat_g: round(totals.fat_g),
      },
      degraded,
    };

    this.logger.log(
      `analysis_completed request_id=${requestId} model=${cfg.gemini.model} ` +
        `image_bytes=${image.bytes} image_mime=${image.mimeType} detected_items=${detected.length} ` +
        `matched_items=${items.length - unmatched.length} unmatched_items=${unmatched.length} degraded=${degraded}`
    );

    return analyzeResponseSchema.parse(response);
  }

  async searchFoods(q: string, requestId: string): Promise<{ request_id: string; candidates: FoodCandidate[] }> {
    const candidates = await this.usda.searchCandidates(q, 8);

    this.logger.log(`food_search request_id=${requestId} result_count=${candidates.length}`);

    return { request_id: requestId, candidates };
  }

  async getFood(fdcId: number, requestId: string): Promise<FoodDetailResponse> {
    const nut = await this.usda.getNutrients(fdcId);

    return {
      request_id: requestId,
      fdc_id: nut.fdcId,
      description: nut.description,
      data_type: nut.dataType,
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