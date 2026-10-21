import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createOpenApiDocument, setupOpenApi, swaggerEnabled } from './openapi.js';

@Controller('example')
class ExampleController { @Get() example() { return { ok: true }; } }
@Module({ controllers: [ExampleController] })
class ExampleModule {}

describe('OpenAPI gate and error contract', () => {
  it('requires an explicit flag and never enables production or unknown environments', () => {
    expect(swaggerEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(swaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })).toBe(false);
    expect(swaggerEnabled({ NODE_ENV: 'staging', SWAGGER_ENABLED: 'true' })).toBe(false);
    expect(swaggerEnabled({ NODE_ENV: 'development', SWAGGER_ENABLED: 'true' })).toBe(true);
  });
  it.each(['development', 'production'])('serves docs only for explicitly enabled development (%s)', async (NODE_ENV) => {
    const module = await Test.createTestingModule({ imports: [ExampleModule] }).compile();
    const app = module.createNestApplication({ logger: false });
    setupOpenApi(app, { NODE_ENV, SWAGGER_ENABLED: 'true' });
    await app.init();
    try {
      const response = await request(app.getHttpServer()).get('/docs');
      expect(response.status).toBe(NODE_ENV === 'production' ? 404 : 200);
      const json = await request(app.getHttpServer()).get('/docs/openapi.json');
      expect(json.status).toBe(NODE_ENV === 'production' ? 404 : 200);
      if (NODE_ENV === 'development') {
        expect(response.headers['content-security-policy']).toContain("script-src 'self'");
        expect(json.body.components.securitySchemes).toHaveProperty('bearer');
        expect(json.body.components.schemas.StandardError.required).toContain('request_id');
      }
      expect(createOpenApiDocument(app).paths['/example'].get.responses['401']).toBeDefined();
    } finally { await app.close(); }
  });
});
