import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { PoseController } from '../src/pose/pose.controller.js';
import { PoseService } from '../src/pose/pose.service.js';

describe('pose upload validation', () => {
  it('accepts a large valid Base64 upload and rejects malformed input without calling the service', async () => {
    const service = { analyze: vi.fn(async () => ({ observations: ['ok'] })) };
    const moduleRef = await Test.createTestingModule({ controllers: [PoseController], providers: [PoseService] })
      .overrideProvider(PoseService).useValue(service)
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true }).compile();
    const app = moduleRef.createNestApplication({ bodyParser: false });
    app.use(json({ limit: '28mb' }));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    try {
      const body = { mediaBase64: Buffer.alloc(20 * 1024 * 1024).toString('base64'), mimeType: 'video/mp4' };
      expect((await request(app.getHttpServer()).post('/pose/analyze').send(body)).status).toBe(201);
      expect((await request(app.getHttpServer()).post('/pose/analyze').send({ ...body, mediaBase64: 'AAA!' })).status).toBe(400);
      expect(service.analyze).toHaveBeenCalledTimes(1);
    } finally { await app.close(); }
  }, 30_000);
});
