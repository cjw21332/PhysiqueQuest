import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtStrategy } from '../src/auth/jwt.strategy.js';
import { scannerBodyErrorHandler } from '../src/common/foodscan/app-exception.filter.js';
import { FoodScanConfigService } from '../src/common/foodscan/foodscan-config.js';
import { PinoLogger } from '../src/common/foodscan/pino-logger.js';
import { FoodScanModule, SCANNER_ROUTE_PATHS } from '../src/foodscan/foodscan.module.js';
import { server } from './foodscan.harness.js';
import { JSON_HEADERS, TINY_PNG_BASE64 } from './foodscan.fixtures.js';

/**
 * The scanner is no longer gated by a shared secret: it sits behind the same JWT
 * guard as every other endpoint. This replaces the old token tests and uses real
 * signed tokens, so expiry and signature verification are genuinely exercised.
 *
 * Only AuthService is stubbed, because the real one looks the user up in Mongo.
 */
const JWT_SECRET = 'test-jwt-secret-for-scanner-auth-spec';
const OTHER_SECRET = 'a-completely-different-secret';
const USER_ID = '64b7f1c2a1b2c3d4e5f60718';

const sign = (overrides: Record<string, unknown> = {}, secret = JWT_SECRET) =>
  jwt.sign({ sub: USER_ID, email: 'scanner@example.test', ...overrides }, secret, { expiresIn: '5m' });

const expired = () =>
  jwt.sign({ sub: USER_ID, email: 'scanner@example.test' }, JWT_SECRET, { expiresIn: '-1s' });

describe('JWT authentication', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET, JWT_EXPIRES_IN: '5m' })],
        }),
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET }),
        FoodScanModule,
      ],
      providers: [
        // AuthModule is not imported here (it would drag in Mongoose), so the
        // strategy and the one collaborator it needs are declared directly.
        // Mirrors the real service: a sub that resolves to no user is rejected.
        {
          provide: AuthService,
          useValue: {
            validateUser: vi.fn(async (sub: string) => {
              if (sub !== USER_ID) throw new UnauthorizedException('User no longer exists');
              return { _id: USER_ID };
            }),
          },
        },
        JwtStrategy,
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    const config = app.get(FoodScanConfigService);
    app.useBodyParser('json', { limit: config.value.maxBodyBytes });
    app.use(scannerBodyErrorHandler(app.get(PinoLogger), SCANNER_ROUTE_PATHS as unknown as string[]));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const protectedRoutes: Array<[string, string]> = [
    ['post', '/nutrition/scan'],
    ['get', '/nutrition/foods/search?q=apple'],
    ['get', '/nutrition/foods/171477'],
  ];

  describe('rejects unauthenticated requests', () => {
    for (const [method, path] of protectedRoutes) {
      it(`${method.toUpperCase()} ${path} returns 401 without credentials`, async () => {
        const res = await (method === 'post'
          ? server(app).post(path).set(JSON_HEADERS).send({ image: TINY_PNG_BASE64 })
          : server(app).get(path));

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
        expect(res.body.error.request_id).toBeTruthy();
      });
    }
  });

  it('rejects an empty bearer token', async () => {
    expect((await server(app).post('/nutrition/scan').set(bearer('')).set(JSON_HEADERS).send({ image: TINY_PNG_BASE64 })).status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    expect((await server(app).post('/nutrition/scan').set(bearer('not-a-jwt')).set(JSON_HEADERS).send({ image: TINY_PNG_BASE64 })).status).toBe(401);
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = sign({}, OTHER_SECRET);
    const res = await server(app).post('/nutrition/scan').set(bearer(forged)).set(JSON_HEADERS).send({ image: TINY_PNG_BASE64 });
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const res = await server(app).post('/nutrition/scan').set(bearer(expired())).set(JSON_HEADERS).send({ image: TINY_PNG_BASE64 });
    expect(res.status).toBe(401);
  });

  it('rejects a validly signed token for a user that no longer exists', async () => {
    // Signature and expiry are fine; the subject simply does not resolve.
    const res = await server(app).post('/nutrition/scan').set(bearer(sign({ sub: '64b7f1c2a1b2c3d4e5f60000' }))).set(JSON_HEADERS).send({ image: TINY_PNG_BASE64 });
    expect(res.status).toBe(401);
  });

  it('never echoes the presented credential back to the caller', async () => {
    const guess = 'super-secret-guess-value-0123456789';
    const res = await server(app).post('/nutrition/scan').set(bearer(guess)).set(JSON_HEADERS).send({ image: TINY_PNG_BASE64 });
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain(guess);
  });

  it('accepts a valid token and reaches the handler', async () => {
    // No Gemini key is configured here, so a valid token gets past auth and then
    // fails later with 503. Reaching the provider stage is the point.
    const res = await server(app).post('/nutrition/scan').set(bearer(sign())).set(JSON_HEADERS).send({ image: TINY_PNG_BASE64 });
    expect(res.status).not.toBe(401);
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('accepts a valid token on the food search routes', async () => {
    const res = await server(app).get('/nutrition/foods/search?q=apple').set(bearer(sign()));
    expect(res.status).not.toBe(401);
  });
});
