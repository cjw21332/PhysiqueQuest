import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiRateLimitGuard } from './ai-rate-limit.guard.js';
import { consumeQuota } from '../privacy/lifecycle-quota.js';
vi.mock('../privacy/lifecycle-quota.js', () => ({ consumeQuota: vi.fn() }));

const connection = { db: { collection: () => ({ createIndex: async () => 'ttl' }) } };
const fixture = () => {
  const response = { setHeader: vi.fn() };
  const request = { user: { userId: '507f1f77bcf86cd799439011', lifecycleGeneration: 1 } };
  return { response, request, context: { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) } as never };
};
afterEach(() => { vi.clearAllMocks(); });
describe('shared AI quota', () => {
  it('allows requests within both limits', async () => {
    vi.mocked(consumeQuota).mockResolvedValueOnce([1, 1]);
    const { context } = fixture();
    expect(await new AiRateLimitGuard(connection as never).canActivate(context)).toBe(true);
    expect(consumeQuota).toHaveBeenCalledWith(connection, expect.any(String), expect.arrayContaining([expect.objectContaining({ owned: true }), expect.objectContaining({ owned: false })]), 1);
  });
  it('rejects exhausted quotas with a retry header', async () => {
    vi.mocked(consumeQuota).mockResolvedValueOnce([31, 1]);
    const { context, response } = fixture();
    await expect(new AiRateLimitGuard(connection as never).canActivate(context)).rejects.toMatchObject({ status: 429 });
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });
  it('fails closed if quota storage is unavailable', async () => {
    vi.mocked(consumeQuota).mockRejectedValueOnce(new Error('database unavailable'));
    const { context } = fixture();
    await expect(new AiRateLimitGuard(connection as never).canActivate(context)).rejects.toMatchObject({ status: 503 });
  });
});
