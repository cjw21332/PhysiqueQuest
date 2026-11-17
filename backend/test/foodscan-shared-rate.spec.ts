import { describe, expect, it, vi } from 'vitest';
import { ScanRateLimitGuard } from '../src/common/foodscan/scan-rate-limit.guard.js';
import { ErrorCode } from '../src/common/foodscan/errors.js';
import { quotaModel } from './lifecycle-quota.fixture.js';

describe('shared scanner rate limits', () => {
  it('uses shared atomic buckets across guard instances and separates users', async () => {
    const hits = new Map<string, number>();
    const collection = { createIndex: vi.fn().mockResolvedValue('ttl'), findOneAndUpdate: vi.fn(async ({ _id }: { _id: string }) => { const count = (hits.get(_id) ?? 0) + 1; hits.set(_id, count); return { hits: count }; }) };
    const config = { value: { rateLimit: { enabled: true, max: 1, windowMs: 60000 } } };
    const connection = quotaModel(collection).db;
    const make = () => new ScanRateLimitGuard(config as never, { event: vi.fn() } as never, connection as never);
    const context = (userId: string) => ({ switchToHttp: () => ({ getRequest: () => ({ user: { userId, lifecycleGeneration: 0 }, path: '/nutrition/scan' }), getResponse: () => ({ setHeader: vi.fn() }) }) }) as never;
    await expect(make().canActivate(context('aaaaaaaaaaaaaaaaaaaaaaaa'))).resolves.toBe(true);
    await expect(make().canActivate(context('aaaaaaaaaaaaaaaaaaaaaaaa'))).rejects.toMatchObject({ code: ErrorCode.RATE_LIMITED });
    await expect(make().canActivate(context('bbbbbbbbbbbbbbbbbbbbbbbb'))).resolves.toBe(true);
    expect(collection.findOneAndUpdate.mock.calls[0][2]).toMatchObject({ upsert: true, returnDocument: 'after' });
  });
  it('fails closed if shared storage is unavailable', async () => {
    const guard = new ScanRateLimitGuard({ value: { rateLimit: { enabled: true } } } as never, {} as never);
    const context = { switchToHttp: () => ({ getRequest: () => ({ user: { userId: 'one' } }), getResponse: () => ({ setHeader: vi.fn() }) }) };
    await expect(guard.canActivate(context as never)).rejects.toMatchObject({ code: ErrorCode.SERVICE_UNAVAILABLE });
  });
});
