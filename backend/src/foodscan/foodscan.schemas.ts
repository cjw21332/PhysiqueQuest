import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { FoodScanConfigService } from '../common/foodscan/foodscan-config.js';

/**
 * Runtime schemas for the food scan contract.
 *
 * These schemas are the authoritative definition of what a caller may send and
 * what these endpoints return. They are intentionally NOT class-validator DTOs:
 * the scan body carries a multi-megabyte base64 image, and the strict request
 * shape plus the exact 413/415 distinction are part of the published contract.
 */

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

const MIME_ALLOWLIST = new Set<string>(IMAGE_MIME_TYPES);

const DATA_URL_PREFIX = /^data:([a-z]+\/[a-z0-9.+-]+);base64,/i;
// Strict base64: alphabet plus padding, length a multiple of 4.
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export const DEFAULT_MAX_SEARCH_QUERY_LENGTH = 120;

/** Magic-byte signatures. A declared MIME type is advisory; these are authoritative. */
function sniffImageMime(buf: Buffer): ImageMimeType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export class ImagePayloadError extends Error {
  readonly reason: string;
  readonly details?: Record<string, unknown>;
  constructor(message: string, reason: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ImagePayloadError';
    this.reason = reason;
    this.details = details;
  }
}

export interface NormalizedImage {
  base64: string;
  mimeType: ImageMimeType;
  bytes: number;
}

// --------------------------------------------------------------------------
// Request schemas
// --------------------------------------------------------------------------

export const analyzeRequestSchema = z.strictObject({
  /**
   * Base64-encoded image. A `data:<mime>;base64,` prefix is tolerated and
   * stripped. Image URLs are deliberately not accepted: fetching a
   * caller-supplied URL server-side is an SSRF primitive against the private
   * network this backend runs in.
   */
  image: z.string({ error: 'image is required' }).min(1, 'image must not be empty'),
  /** Advisory. The server determines the real type from the image bytes. */
  mimeType: z.string().optional(),
});

/** Built per-request-budget because the search cap is configurable. */
export function buildFoodSearchQuerySchema(maxSearchQueryLength: number) {
  return z
    .object({
      q: z
        .string({ error: 'q is required' })
        .transform((s) => s.trim())
        .refine((s) => s.length > 0, 'q must not be empty'),
    })
    .superRefine((obj, ctx) => {
      if (obj.q.length > maxSearchQueryLength) {
        ctx.addIssue({
          code: 'custom',
          path: ['q'],
          message: `q must be at most ${maxSearchQueryLength} characters`,
        });
      }
    });
}

export const fdcIdParamSchema = z.object({
  fdcId: z
    .string({ error: 'fdcId is required' })
    .regex(/^[1-9]\d{0,11}$/, 'fdcId must be a positive integer')
    .transform((s) => Number.parseInt(s, 10))
    .refine((n) => Number.isSafeInteger(n) && n > 0, 'fdcId is out of range'),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

// --------------------------------------------------------------------------
// Response schemas
// --------------------------------------------------------------------------

export const macrosSchema = z.object({
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
});

export const analyzedItemSchema = z.object({
  food_name: z.string(),
  est_weight_g: z.number(),
  confidence: z.number(),
  found: z.boolean(),
  fdc_id: z.number().optional(),
  description: z.string().optional(),
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  per_100g: macrosSchema.optional(),
});

export const analyzeResponseSchema = z.object({
  request_id: z.string(),
  model: z.string(),
  items: z.array(analyzedItemSchema),
  unmatched: z.array(z.string()),
  totals: macrosSchema,
  degraded: z.boolean(),
});

export const foodCandidateSchema = z.object({
  fdc_id: z.number(),
  description: z.string(),
  data_type: z.string(),
});

export const foodSearchResponseSchema = z.object({
  request_id: z.string(),
  candidates: z.array(foodCandidateSchema),
});

export const foodDetailResponseSchema = z.object({
  request_id: z.string(),
  fdc_id: z.number(),
  description: z.string(),
  data_type: z.string(),
  per_100g: macrosSchema,
  serving_size_g: z.number().positive().optional(),
});

export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
export type AnalyzedItem = z.infer<typeof analyzedItemSchema>;
export type Macros = z.infer<typeof macrosSchema>;
export type FoodCandidate = z.infer<typeof foodCandidateSchema>;
export type FoodSearchResponse = z.infer<typeof foodSearchResponseSchema>;
export type FoodDetailResponse = z.infer<typeof foodDetailResponseSchema>;

/**
 * Image payload validation and the query-string schemas that depend on config.
 *
 * The service methods are thin wrappers so the controllers depend on an
 * injectable rather than reaching for the config singleton themselves.
 */
@Injectable()
export class FoodScanSchemasService {
  constructor(private readonly config: FoodScanConfigService) {}

  /**
   * Validates an image payload: base64 well-formedness, a decoded size within
   * budget, and a real image signature. Without the signature check a caller
   * could label arbitrary bytes as an image and have them forwarded verbatim to
   * the vision model.
   */
  normalizeImagePayload(raw: string, declaredMimeType?: string): NormalizedImage {
    const maxImageBytes = this.config.maxImageBytes;

    let base64 = raw.trim();
    const prefix = base64.match(DATA_URL_PREFIX);
    if (prefix) {
      const prefixMime = prefix[1].toLowerCase();
      if (!MIME_ALLOWLIST.has(prefixMime)) {
        throw new ImagePayloadError(`Unsupported image type "${prefixMime}"`, prefixMime);
      }
      base64 = base64.slice(prefix[0].length);
    }

    base64 = base64.replace(/\s+/g, '');
    if (!base64) throw new ImagePayloadError('image is empty', 'empty');
    if (!BASE64.test(base64) || base64.length % 4 !== 0) {
      throw new ImagePayloadError('image is not valid base64', 'malformed_base64');
    }

    // Reject on the encoded length first, so an oversized payload is never
    // decoded into memory.
    const approxBytes = Math.floor((base64.length * 3) / 4);
    if (approxBytes > maxImageBytes) {
      throw new ImagePayloadError(`image exceeds the ${maxImageBytes} byte limit`, 'too_large', {
        max_image_bytes: maxImageBytes,
      });
    }

    const buf = Buffer.from(base64, 'base64');
    if (buf.byteLength === 0) throw new ImagePayloadError('image is empty', 'empty');

    const detected = sniffImageMime(buf);
    if (!detected) {
      throw new ImagePayloadError(
        'image bytes do not match a supported image format (jpeg, png, webp)',
        'unrecognized_format'
      );
    }

    // A declared type that contradicts the bytes is a caller bug worth surfacing,
    // but the bytes are what actually get sent upstream.
    if (declaredMimeType && !MIME_ALLOWLIST.has(declaredMimeType.toLowerCase())) {
      throw new ImagePayloadError(`Unsupported image type "${declaredMimeType}"`, declaredMimeType);
    }

    return { base64, mimeType: detected, bytes: buf.byteLength };
  }

  parseFoodSearchQuery(raw: unknown): { q: string } {
    return buildFoodSearchQuerySchema(this.config.maxSearchQueryLength).parse(raw);
  }
}
