import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { buildScannerApp, server } from './foodscan.harness.js';
import {
  JSON_HEADERS,
  MALFORMED_BASE64,
  NOT_AN_IMAGE_BASE64,
  TINY_PNG_BASE64,
} from './foodscan.fixtures.js';

/**
 * The HTTP surface of the scanner. Auth is stubbed here; foodscan-auth.spec.ts
 * covers the JWT requirement itself.
 */
describe('scanner request validation', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildScannerApp({ FOODSCAN_MAX_IMAGE_BYTES: '4096' }, { auth: false });
  });

  afterAll(async () => {
    await app?.close();
  });

  const post = (body: unknown, ct: string = JSON_HEADERS['content-type']) =>
    server(app).post('/nutrition/scan').set('content-type', ct).send(body as object);

  describe('POST /nutrition/scan body', () => {
    it('rejects a missing image with 400', async () => {
      const res = await post({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    });

    it('rejects a non-string image with 400', async () => {
      const res = await post({ image: 12345 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    });

    it('rejects an empty image with 400', async () => {
      expect((await post({ image: '' })).status).toBe(400);
    });

    it('rejects unknown top-level fields with 400', async () => {
      const res = await post({
        image: TINY_PNG_BASE64,
        imageUrl: 'http://169.254.169.254/latest/meta-data/',
      });
      expect(res.status).toBe(400);
    });

    it('rejects malformed base64 with 400', async () => {
      const res = await post({ image: MALFORMED_BASE64 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    });

    it('rejects unparseable JSON with 400', async () => {
      const res = await server(app)
        .post('/nutrition/scan')
        .set('content-type', 'application/json')
        .send('{not json');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    });

    it('rejects a non-JSON content type with 415', async () => {
      const res = await post('image=http://example.com/a.jpg', 'text/plain');
      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects a body over the size limit with 413', async () => {
      const huge = Buffer.alloc(300 * 1024, 0x41).toString('base64');
      const res = await post({ image: huge });
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('image content validation', () => {
    it('rejects valid base64 that is not an image with 415', async () => {
      const res = await post({ image: NOT_AN_IMAGE_BASE64 });
      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects an unsupported declared mime type with 415', async () => {
      const res = await post({ image: TINY_PNG_BASE64, mimeType: 'image/gif' });
      expect(res.status).toBe(415);
    });

    it('rejects a data: URL with an unsupported type with 415', async () => {
      const res = await post({ image: `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}` });
      expect(res.status).toBe(415);
    });

    it('rejects a non-base64 data: URL with 400', async () => {
      const res = await post({ image: 'data:image/png;base64,!!!!' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /nutrition/foods/search', () => {
    it('rejects a missing q with 400', async () => {
      const res = await server(app).get('/nutrition/foods/search');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    });

    it('rejects a blank q with 400', async () => {
      expect((await server(app).get('/nutrition/foods/search?q=%20%20')).status).toBe(400);
    });

    it('rejects an over-long q with 400', async () => {
      expect((await server(app).get(`/nutrition/foods/search?q=${'a'.repeat(500)}`)).status).toBe(400);
    });
  });

  describe('GET /nutrition/foods/:fdcId', () => {
    it.each([
      ['abc', 'letters'],
      ['0', 'zero'],
      ['-5', 'negative'],
      ['1.5', 'decimal'],
      ['1e5', 'exponent'],
      ['99999999999999', 'out of range'],
    ])('rejects fdcId %s (%s) with 400', async (fdcId) => {
      const res = await server(app).get(`/nutrition/foods/${fdcId}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    });
  });

  describe('error envelope', () => {
    it('always carries code, message and request_id', async () => {
      const res = await post({});
      expect(res.body).toEqual({
        error: {
          code: 'INVALID_REQUEST',
          message: expect.any(String),
          request_id: expect.any(String),
          details: expect.anything(),
        },
      });
    });

    it('generates a fresh request id', async () => {
      const res = await post({});
      expect(res.body.error.request_id).toMatch(/[0-9a-f-]{36}/);
    });

    it('honours a valid inbound x-request-id for correlation', async () => {
      const res = await server(app)
        .post('/nutrition/scan')
        .set('x-request-id', 'main-backend-trace-12345')
        .set(JSON_HEADERS)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.request_id).toBe('main-backend-trace-12345');
      expect(res.headers['x-request-id']).toBe('main-backend-trace-12345');
    });

    it('ignores a forged inbound x-request-id and generates its own', async () => {
      const res = await server(app)
        .post('/nutrition/scan')
        .set('x-request-id', 'bad id with spaces and | pipes')
        .set(JSON_HEADERS)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.request_id).not.toBe('bad id with spaces and | pipes');
      expect(res.body.error.request_id).toMatch(/^[A-Za-z0-9._:-]+$/);
    });

    it('returns per-field validation details', async () => {
      const res = await post({ image: 42, extra: true });
      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.error.details.issues)).toBe(true);
      expect(res.body.error.details.issues.length).toBeGreaterThan(0);
    });
  });
});
