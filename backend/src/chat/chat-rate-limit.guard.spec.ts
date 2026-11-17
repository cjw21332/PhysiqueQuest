import { quotaModel } from '../../test/lifecycle-quota.fixture.js';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ChatRateLimitGuard } from './chat-rate-limit.guard.js';
function context(userId: string, ip: string) {
  const setHeader = vi.fn();
  return { switchToHttp: () => ({ getRequest: () => ({ user: { userId: createHash('sha256').update(userId).digest('hex').slice(0,24), lifecycleGeneration: 0 }, ip }), getResponse: () => ({ setHeader }) }) } as never;
}
describe('Phiq quotas', () => {
  it('limits account even if its IP changes', async () => {
    const guard = new ChatRateLimitGuard(quotaModel() as never);
    for (let i = 0; i < 10; i++) expect(await guard.canActivate(context('owner', String(i)))).toBe(true);
    await expect(guard.canActivate(context('owner', 'next'))).rejects.toThrow('Too many');
    expect(await guard.canActivate(context('other', 'next-other'))).toBe(true);
  });
  it('limits an IP even if accounts change', async () => {
    const guard = new ChatRateLimitGuard(quotaModel() as never);
    for (let i = 0; i < 30; i++) expect(await guard.canActivate(context(String(i), 'same'))).toBe(true);
    await expect(guard.canActivate(context('next', 'same'))).rejects.toThrow('Too many');
  });
  it('shares atomic quota counters between API replicas without raw identities', async () => {
    const counts = new Map<string, number>();
    const findOneAndUpdate = vi.fn(async (filter: { _id: string }) => {
      counts.set(filter._id, (counts.get(filter._id) ?? 0) + 1);
      return { hits: counts.get(filter._id) };
    });
    const one = new ChatRateLimitGuard(quotaModel({ findOneAndUpdate }) as never);
    const two = new ChatRateLimitGuard(quotaModel({ findOneAndUpdate }) as never);
    for (let i = 0; i < 10; i++) expect(await (i % 2 ? one : two).canActivate(context('private-owner', 'private-ip'))).toBe(true);
    await expect(two.canActivate(context('private-owner', 'other-ip'))).rejects.toThrow('Too many');
    expect(JSON.stringify(findOneAndUpdate.mock.calls)).not.toContain('private-owner');
    expect(JSON.stringify(findOneAndUpdate.mock.calls)).not.toContain('private-ip');
    expect(findOneAndUpdate.mock.calls[0][0]._id).toMatch(/^[a-f0-9]{64}$/);
  });
  it('fails closed when the shared quota store is unavailable', async () => {
    const guard = new ChatRateLimitGuard({ findOneAndUpdate: vi.fn().mockRejectedValue(new Error('PRIVATE-CONNECTION')) } as never);
    await expect(guard.canActivate(context('owner', 'ip'))).rejects.toThrow('temporarily unavailable');
  });
});
