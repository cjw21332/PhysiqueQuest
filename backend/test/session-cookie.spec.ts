import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller.js';
import { EmailVerificationService } from '../src/auth/email-verification.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { SessionService } from '../src/auth/session.service.js';
import { PasswordRecoveryService } from '../src/auth/password-recovery.service.js';
import { sessionCookieOptions } from '../src/auth/session-cookie.js';

describe('httpOnly session cookie boundary', () => {
  let app: INestApplication;
  const secret = `${'a'.repeat(64)}.${'b'.repeat(64)}`;
  const result = { access_token: 'short-access', refresh_token: secret, expires_in: 900, user: { id: 'owner', name: 'Owner', email: 'owner@example.com' } };
  const sessions = { issue: vi.fn(async () => result), refresh: vi.fn(async () => result) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AuthController], providers: [
      { provide: EmailVerificationService, useValue: { request: async () => ({ accepted: true }) } },
      { provide: AuthService, useValue: { login: async () => ({ user: { id: 'owner' } }), validateUser: async () => result.user } },
      { provide: PasswordRecoveryService, useValue: {} }, { provide: SessionService, useValue: sessions },
    ] }).compile();
    app = module.createNestApplication(); app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(async () => { await app?.close(); });
  it('delivers refresh only by HttpOnly cookie and accepts it on the next request', async () => {
    const response = await request(app.getHttpServer()).post('/api/auth/session/login').set('Origin', 'http://localhost:3000').send({ email: 'owner@example.com', password: 'Test1234!' }).expect(200);
    expect(JSON.stringify(response.body)).not.toContain(secret);
    expect(response.body.refresh_token).toBeUndefined();
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies[0]).toContain('HttpOnly'); expect(cookies[0]).toContain('SameSite=Lax'); expect(cookies[0]).toContain('Path=/api;');
    await request(app.getHttpServer()).post('/api/auth/session/refresh').set('Cookie', cookies[0].split(';')[0]).send({}).expect(200);
    expect(sessions.refresh).toHaveBeenCalledWith(secret);
  });
  it('rejects foreign origins, form posts and unknown payload fields', async () => {
    await request(app.getHttpServer()).post('/api/auth/session/refresh').set('Origin', 'https://attacker.invalid').send({}).expect(403);
    await request(app.getHttpServer()).post('/api/auth/session/refresh').type('form').send('x=y').expect(400);
    await request(app.getHttpServer()).post('/api/auth/session/refresh').send({ role: 'admin' }).expect(400);
  });
  it('uses secure, host-only production defaults', () => {
    expect(sessionCookieOptions({ NODE_ENV: 'production' })).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax' });
    expect(sessionCookieOptions({ NODE_ENV: 'production' }).domain).toBeUndefined();
  });
});
