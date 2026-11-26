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
import { GoogleAuthService } from '../src/auth/google-auth.service.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';

describe('httpOnly session cookie boundary', () => {
  let app: INestApplication;
  const secret = `${'a'.repeat(64)}.${'b'.repeat(64)}`;
  const result = { access_token: 'short-access', refresh_token: secret, expires_in: 900, user: { id: 'owner', name: 'Owner', email: 'owner@example.com' } };
  const sessions = { issue: vi.fn(async () => result), refresh: vi.fn(async () => result), revokeToken: vi.fn(async () => {}), revoke: vi.fn(async () => {}) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AuthController], providers: [
      { provide: EmailVerificationService, useValue: { request: async () => ({ accepted: true }) } },
      { provide: AuthService, useValue: { login: async () => ({ user: { id: 'owner' } }), validateUser: async () => result.user } },
      { provide: PasswordRecoveryService, useValue: {} }, { provide: SessionService, useValue: sessions },
      { provide: GoogleAuthService, useValue: {} },
    ] }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => { context.switchToHttp().getRequest().user = { userId: 'owner', sessionId: 'd'.repeat(64) }; return true; } }).compile();
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
  it('lets the native app shell refresh with its secure-store token, never a page script', async () => {
    const response = await request(app.getHttpServer()).post('/api/auth/session/device/refresh').set('X-PQ-Device', '1').send({ token: secret }).expect(200);
    expect(response.body).toMatchObject({ access_token: 'short-access', device_token: secret, user: { id: 'owner' } });
    expect(response.body.refresh_token).toBeUndefined();
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
    // Browsers always send Origin on POST, so a page (or an injected script) is refused.
    await request(app.getHttpServer()).post('/api/auth/session/device/refresh').set('X-PQ-Device', '1').set('Origin', 'http://localhost:3000').send({ token: secret }).expect(403);
    await request(app.getHttpServer()).post('/api/auth/session/device/refresh').send({ token: secret }).expect(403);
    await request(app.getHttpServer()).post('/api/auth/session/device/refresh').set('X-PQ-Device', '1').send({ token: 'not-a-token' }).expect(401);
  });
  it('device logout revokes the stored session and always succeeds', async () => {
    await request(app.getHttpServer()).post('/api/auth/session/device/logout').set('X-PQ-Device', '1').send({ token: secret }).expect(200);
    expect(sessions.revokeToken).toHaveBeenCalledWith(secret);
    await request(app.getHttpServer()).post('/api/auth/session/device/logout').set('X-PQ-Device', '1').send({}).expect(200);
  });
  it('logout ends both the signed-in session and the session behind the refresh cookie', async () => {
    sessions.revokeToken.mockClear();
    await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', `pq_refresh=${secret}`).send({}).expect(200);
    expect(sessions.revoke).toHaveBeenCalledWith('d'.repeat(64), 'owner');
    expect(sessions.revokeToken).toHaveBeenCalledWith(secret);
  });
  it('uses secure, host-only production defaults', () => {
    expect(sessionCookieOptions({ NODE_ENV: 'production' })).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax' });
    expect(sessionCookieOptions({ NODE_ENV: 'production' }).domain).toBeUndefined();
  });
  it('can issue secure host-only cross-site cookies when explicitly configured', () => {
    expect(sessionCookieOptions({ NODE_ENV: 'production', COOKIE_SECURE: 'true', COOKIE_SAMESITE: 'none' })).toMatchObject({
      httpOnly: true, secure: true, sameSite: 'none', path: '/api',
    });
    expect(sessionCookieOptions({ NODE_ENV: 'production', COOKIE_SECURE: 'true', COOKIE_SAMESITE: 'none' }).domain).toBeUndefined();
  });
});
