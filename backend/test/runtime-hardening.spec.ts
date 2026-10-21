import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { validateEnvironment } from '../src/config/environment.js';
import { securityMiddleware } from '../src/common/security.middleware.js';
import { SafeExceptionFilter } from '../src/common/safe-exception.filter.js';
import { queryValidationMiddleware } from '../src/common/query-validation.middleware.js';
import { rateLimited } from '../src/common/foodscan/errors.js';

describe('production configuration', () => {
  const production = { NODE_ENV: 'production', MONGODB_URI: 'mongodb://db/app', JWT_SECRET: 'x'.repeat(48), STORAGE_DRIVER: 's3', S3_BUCKET: 'synthetic-private-bucket', HEALTH_DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), FRONTEND_URL: 'https://app.example.com', API_PUBLIC_URL: 'https://api.example.com' };
  it('accepts explicit HTTPS production configuration', () => expect(validateEnvironment(production)).toEqual(production));
  it('rejects missing/placeholder secrets, insecure origins, malformed versions and invalid pool sizes without echoing values', () => {
    for (const patch of [{ HEALTH_DATA_ENCRYPTION_KEY: '' }, { HEALTH_DATA_ENCRYPTION_KEY: 'invalid' }, { SWAGGER_ENABLED: 'yes' }, { ACCOUNT_DELETION_GRACE_DAYS: '0' }, { JWT_SECRET: '' }, { JWT_SECRET: 'replace_with_a_long_random_string' }, { FRONTEND_URL: '*' }, { FRONTEND_URL: 'http://app.example.com' }, { MIN_APP_VERSION: 'banana' }, { DB_MAX_POOL_SIZE: '0' }])
      expect(() => validateEnvironment({ ...production, ...patch })).toThrow();
  });
});

describe('request protection', () => {
  it('preserves shared quota errors on new non-scanner job routes', () => {
    const res: any = { headersSent: false, setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const host: any = { switchToHttp: () => ({ getRequest: () => ({ requestId: 'synthetic' }), getResponse: () => res }) };
    new SafeExceptionFilter({ error: vi.fn() } as any).catch(rateLimited('Wait before retrying', 60), host);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'RATE_LIMITED' }));
  });
  it('rejects unknown query fields and NoSQL operators, including versioned routes', () => {
    const next = vi.fn(); const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    for (const query of [{ 'metric[$ne]': 'x' }, { metric: { $ne: 'x' } }, { metric: ['weight'] }]) {
      queryValidationMiddleware({ path: '/api/v1/progress', method: 'GET', query } as any, res, next);
      expect(res.status).toHaveBeenLastCalledWith(400);
    }
    expect(next).not.toHaveBeenCalled();
    queryValidationMiddleware({ path: '/api/v1/progress', method: 'GET', query: { metric: 'weight', limit: '10' } } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
  function run(headers: Record<string, string> = {}, env = {}) {
    const sent: Record<string, string> = {};
    const res: any = { setHeader: (key: string, value: string) => { sent[key] = value; }, status: vi.fn().mockReturnThis(), json: vi.fn(), redirect: vi.fn() };
    const req: any = { headers, method: 'GET', path: '/api/profile', secure: true };
    const next = vi.fn(); securityMiddleware(env)(req, res, next);
    return { req, res, sent, next };
  }
  it('sets security headers, no-store and a bounded correlation ID', () => {
    const r = run({ 'x-request-id': '\nunsafe' });
    expect(r.sent['X-Content-Type-Options']).toBe('nosniff');
    expect(r.sent['Cache-Control']).toBe('no-store');
    expect(r.sent['X-Request-ID']).toMatch(/^[a-f0-9-]{36}$/);
    expect(r.next).toHaveBeenCalledOnce();
  });
  it('enforces a configured version floor while preserving unversioned legacy clients by default', () => {
    expect(run({}, { MIN_APP_VERSION: '2.0.0' }).next).toHaveBeenCalledOnce();
    const old = run({ 'x-app-version': '1.9.9' }, { MIN_APP_VERSION: '2.0.0' });
    expect(old.res.status).toHaveBeenCalledWith(426);
    expect(old.res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'APP_UPDATE_REQUIRED' }));
  });
  it('hides unexpected error details and preserves compatible top-level fields', () => {
    const res: any = { headersSent: false, status: vi.fn().mockReturnThis(), json: vi.fn() };
    const host: any = { switchToHttp: () => ({ getRequest: () => ({ requestId: 'correlation' }), getResponse: () => res }) };
    new SafeExceptionFilter({ error: vi.fn() } as any).catch(new Error('private database credentials'), host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error', code: 'INTERNAL', request_id: 'correlation' });
  });
});
