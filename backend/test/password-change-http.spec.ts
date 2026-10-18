import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { PasswordRecoveryService } from '../src/auth/password-recovery.service.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';

describe('authenticated password change HTTP boundary', () => {
  let app: INestApplication;
  const requestId = 'a'.repeat(64), resetToken = 'b'.repeat(64);
  const recovery = {
    requestChange: vi.fn(async () => ({ accepted: true, requestId, email: 'owner@example.com', delivery: 'queued' })),
    verifyChange: vi.fn(async () => ({ verified: true, resetToken })),
    confirmChange: vi.fn(async () => ({ updated: true })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AuthController], providers: [
      { provide: AuthService, useValue: {} }, { provide: PasswordRecoveryService, useValue: recovery },
    ] }).overrideGuard(JwtAuthGuard).useValue({ canActivate(context: any) {
      const req = context.switchToHttp().getRequest();
      if (req.headers.authorization !== 'Bearer fixture-token') throw new UnauthorizedException();
      req.user = { userId: 'authenticated-owner' }; return true;
    } }).compile();
    app = module.createNestApplication(); app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  it('requires login at request, verify and confirm', async () => {
    for (const step of ['request', 'verify', 'confirm']) await request(app.getHttpServer()).post(`/api/auth/password-change/${step}`).send({}).expect(401);
    expect(recovery.requestChange).not.toHaveBeenCalled();
    expect(recovery.verifyChange).not.toHaveBeenCalled(); expect(recovery.confirmChange).not.toHaveBeenCalled();
  });
  it('rejects injected email/account fields and selects the authenticated user for delivery', async () => {
    for (const body of [{ email: 'another@gmail.com' }, { userId: 'another-user' }])
      await request(app.getHttpServer()).post('/api/auth/password-change/request').set('Authorization', 'Bearer fixture-token').send(body).expect(400);
    expect(recovery.requestChange).not.toHaveBeenCalled();
    const response = await request(app.getHttpServer()).post('/api/auth/password-change/request').set('Authorization', 'Bearer fixture-token').send({}).expect(201);
    expect(response.body.email).toBe('owner@example.com');
    expect(recovery.requestChange).toHaveBeenCalledWith('authenticated-owner', expect.any(String));
  });
  it('binds verification and confirmation to the authenticated user without accepting an email', async () => {
    await request(app.getHttpServer()).post('/api/auth/password-change/verify').set('Authorization', 'Bearer fixture-token').send({ requestId, code: '123456' }).expect(201);
    expect(recovery.verifyChange).toHaveBeenCalledWith('authenticated-owner', requestId, '123456', expect.any(String));
    await request(app.getHttpServer()).post('/api/auth/password-change/confirm').set('Authorization', 'Bearer fixture-token').send({ resetToken, password: 'NewPass123!' }).expect(201);
    expect(recovery.confirmChange).toHaveBeenCalledWith('authenticated-owner', resetToken, 'NewPass123!', expect.any(String));
  });
});
