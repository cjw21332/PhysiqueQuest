import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';
import { FoodScanConfigService } from '../common/foodscan/foodscan-config.js';
import {
  FoodScanSchemasService,
  ImagePayloadError,
  analyzeRequestSchema,
  buildFoodSearchQuerySchema,
  fdcIdParamSchema,
} from './foodscan.schemas.js';
import { MALFORMED_BASE64, NOT_AN_IMAGE_BASE64, TINY_JPEG_BASE64, TINY_PNG_BASE64 } from '../../test/foodscan.fixtures.js';

/**
 * Validation runs before any provider is contacted, so a malformed request must
 * fail precisely and never reach Gemini or USDA. Exercised here at the schema
 * layer; the HTTP status mapping is asserted in foodscan-validation.spec.ts.
 */
describe('request validation', () => {
  let schemas: FoodScanSchemasService;

  beforeEach(() => {
    schemas = new FoodScanSchemasService(
      new FoodScanConfigService(new ConfigService({ FOODSCAN_MAX_IMAGE_BYTES: '1024' }))
    );
  });

  describe('scan request body', () => {
    it('rejects a missing image', () => {
      expect(analyzeRequestSchema.safeParse({}).success).toBe(false);
    });

    it('rejects a non-string image', () => {
      expect(analyzeRequestSchema.safeParse({ image: 12345 }).success).toBe(false);
    });

    it('rejects an empty image', () => {
      expect(analyzeRequestSchema.safeParse({ image: '' }).success).toBe(false);
    });

    it('rejects unknown top-level fields', () => {
      // An SSRF attempt dressed up as a convenience field. strictObject drops the
      // door rather than silently ignoring it.
      const parsed = analyzeRequestSchema.safeParse({
        image: TINY_PNG_BASE64,
        imageUrl: 'http://169.254.169.254/latest/meta-data/',
      });
      expect(parsed.success).toBe(false);
    });

    it('accepts any advisory mimeType string at the schema layer', () => {
      // The declared type is deliberately not validated here: the bytes decide
      // the real type, and normalizeImagePayload rejects a bogus declaration.
      expect(analyzeRequestSchema.safeParse({ image: TINY_PNG_BASE64, mimeType: 'image/gif' }).success).toBe(true);
    });

    it('accepts a valid request', () => {
      expect(analyzeRequestSchema.safeParse({ image: TINY_PNG_BASE64 }).success).toBe(true);
    });
  });

  describe('image content validation', () => {
    const normalize = (image: string, mimeType?: string) => schemas.normalizeImagePayload(image, mimeType);

    it('rejects malformed base64', () => {
      expect(() => normalize(MALFORMED_BASE64)).toThrow(ImagePayloadError);
    });

    it('rejects valid base64 that is not an image', () => {
      expect(() => normalize(NOT_AN_IMAGE_BASE64)).toThrow(/do not match a supported image format/);
    });

    it('rejects a data: URL with an unsupported type', () => {
      expect(() => normalize(`data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`)).toThrow(
        ImagePayloadError
      );
    });

    it('rejects a non-base64 data: URL', () => {
      expect(() => normalize('data:image/png;base64,!!!!')).toThrow(ImagePayloadError);
    });

    it('rejects an oversized image before decoding it', () => {
      // The cap in beforeEach is 1024 bytes; this payload is far larger.
      const huge = Buffer.alloc(300 * 1024, 0x41).toString('base64');
      expect(() => normalize(huge)).toThrow(/exceeds the 1024 byte limit/);
    });

    it('rejects a declared mime type that is not on the allowlist', () => {
      expect(() => normalize(TINY_PNG_BASE64, 'image/gif')).toThrow(/Unsupported image type/);
    });

    it('takes the mime type from the bytes, not the caller claim', () => {
      // PNG bytes declared as JPEG still report as PNG.
      expect(normalize(TINY_PNG_BASE64, 'image/jpeg').mimeType).toBe('image/png');
      expect(normalize(TINY_JPEG_BASE64).mimeType).toBe('image/jpeg');
    });

    it('normalises a data: URL prefix away', () => {
      const out = normalize(`data:image/png;base64,${TINY_PNG_BASE64}`);
      expect(out.base64).toBe(TINY_PNG_BASE64);
      expect(out.mimeType).toBe('image/png');
    });
  });

  describe('food search query', () => {
    const schema = buildFoodSearchQuerySchema(120);

    it('rejects a missing q', () => {
      expect(schema.safeParse({}).success).toBe(false);
    });

    it('rejects a blank q', () => {
      expect(schema.safeParse({ q: '   ' }).success).toBe(false);
    });

    it('rejects an over-long q', () => {
      expect(schema.safeParse({ q: 'a'.repeat(500) }).success).toBe(false);
    });

    it('trims a valid q', () => {
      expect(schema.parse({ q: '  apple  ' })).toEqual({ q: 'apple' });
    });
  });

  describe('fdcId param', () => {
    it.each([
      ['abc', 'letters'],
      ['0', 'zero'],
      ['-5', 'negative'],
      ['1.5', 'decimal'],
      ['1e5', 'exponent'],
      ['99999999999999', 'out of range'],
    ])('rejects fdcId %s (%s)', (fdcId) => {
      expect(fdcIdParamSchema.safeParse({ fdcId }).success).toBe(false);
    });

    it('accepts a normal id', () => {
      expect(fdcIdParamSchema.safeParse({ fdcId: '171477' }).success).toBe(true);
    });
  });
});
