import 'reflect-metadata';
import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { expect, it } from 'vitest';
import request from 'supertest';
import { compressionMiddleware } from '../src/common/compression.middleware.js';
@Controller() class Fixture { @Get('catalog') catalog() { return { text: 'example '.repeat(1000) }; } }
it('compresses large responses when gzip is accepted and preserves JSON', async () => {
  const module = await Test.createTestingModule({ controllers: [Fixture] }).compile();
  const app = module.createNestApplication(); app.use(compressionMiddleware); await app.init();
  try {
    const response = await request(app.getHttpServer()).get('/catalog').set('Accept-Encoding', 'gzip').expect(200);
    expect(response.headers['content-encoding']).toBe('gzip'); expect(response.body.text).toBe('example '.repeat(1000));
    const plain = await request(app.getHttpServer()).get('/catalog').set('Accept-Encoding', 'gzip;q=0,identity').expect(200);
    expect(plain.headers['content-encoding']).toBeUndefined();
  } finally { await app.close(); }
});
