import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { SafetyController } from '../src/safety/safety.controller.js';
import { SafetyService } from '../src/safety/safety.service.js';

const USER = '507f1f77bcf86cd799439011';
const ALERT = '507f1f77bcf86cd799439013';

describe('POST /safety/alerts/:id/resolve', () => {
  it('resolves the alert for the authenticated user', async () => {
    const service = { resolve: vi.fn(async (userId: string, id: string) => ({ _id: id, userId, flagged: true })) };
    const moduleRef = await Test.createTestingModule({ controllers: [SafetyController], providers: [SafetyService] })
      .overrideProvider(SafetyService).useValue(service)
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = { userId: USER }; return true; } })
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    try {
      const res = await request(app.getHttpServer()).post(`/safety/alerts/${ALERT}/resolve`);
      expect(res.status).toBe(201);
      expect(service.resolve).toHaveBeenCalledWith(USER, ALERT);
      expect(res.body.flagged).toBe(true);
    } finally {
      await app.close();
    }
  });
});
