import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from '../src/auth/session.service.js';
import { JwtStrategy } from '../src/auth/jwt.strategy.js';
afterEach(() => vi.unstubAllEnvs());

function harness() {
  let row: any;
  const model = {
    create: vi.fn(async (value: any) => { row = { ...value, usedHashes: [], revokedAt: null }; return row; }),
    findById: vi.fn(async () => row),
    findOneAndUpdate: vi.fn(async (filter: any, update: any) => {
      if (!row || row._id !== filter._id || row.revokedAt || row.tokenHash !== filter.tokenHash || row.expiresAt <= filter.expiresAt.$gt) return null;
      const old = { ...row }; Object.assign(row, update.$set); row.usedHashes.push(update.$push.usedHashes); return old;
    }),
    updateOne: vi.fn(async (_filter: any, update: any) => { Object.assign(row, update.$set); return { modifiedCount: 1 }; }),
  };
  const user = { _id: '507f1f77bcf86cd799439011', email: 'a@example.com', name: 'A', sessionVersion: 0, isActive: true };
  const users = { findById: vi.fn(async () => user) };
  const jwt = { sign: vi.fn((payload: any, options: any) => JSON.stringify({ ...payload, expiresIn: options.expiresIn })) };
  return { service: new SessionService(model as any, users as any, jwt as any), model, users, user, get row() { return row; } };
}

describe('rotating sessions', () => {
  it('issues 15-minute access tokens and stores only refresh hashes', async () => {
    const h = harness(); const result = await h.service.issue(h.user as any);
    expect(JSON.parse(result.access_token).expiresIn).toBe('15m');
    expect(JSON.stringify(h.row)).not.toContain(result.refresh_token);
    expect(result.refresh_token).toMatch(/^[a-f0-9]{64}\.[a-f0-9]{64}$/);
  });
  it('rotates once and revokes the whole family on replay', async () => {
    const h = harness(); const first = await h.service.issue(h.user as any);
    const next = await h.service.refresh(first.refresh_token);
    expect(next.refresh_token).not.toBe(first.refresh_token);
    await expect(h.service.refresh(first.refresh_token)).rejects.toThrow();
    await expect(h.service.refresh(next.refresh_token)).rejects.toThrow();
    await expect(h.service.validate(h.row._id, h.user._id, 0)).rejects.toThrow();
  });
  it('rejects expired, logged out and password-invalidated sessions', async () => {
    for (const reason of ['expired', 'logout', 'password']) {
      const h = harness(); const first = await h.service.issue(h.user as any);
      if (reason === 'expired') h.row.expiresAt = new Date(0);
      if (reason === 'logout') await h.service.revoke(h.row._id, h.user._id);
      if (reason === 'password') h.user.sessionVersion++;
      await expect(h.service.refresh(first.refresh_token)).rejects.toThrow();
    }
  });
  it('does not revoke a family for an unknown secret', async () => {
    const h = harness(); const first = await h.service.issue(h.user as any);
    await expect(h.service.refresh(`${h.row._id}.${'f'.repeat(64)}`)).rejects.toThrow();
    expect(h.row.revokedAt).toBeNull();
    await expect(h.service.refresh(first.refresh_token)).resolves.toHaveProperty('access_token');
  });
  it('fails closed when refreshes race', async () => {
    const h = harness(); const first = await h.service.issue(h.user as any);
    const results = await Promise.allSettled([h.service.refresh(first.refresh_token), h.service.refresh(first.refresh_token)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(h.row.revokedAt).toBeInstanceOf(Date);
  });
});

describe('legacy compatibility', () => {
  it('allows operators to retire legacy validation explicitly after the rollout gate', async () => {
    vi.stubEnv('LEGACY_AUTH_ENABLED', 'false');
    const strategy = new JwtStrategy({ getOrThrow: () => 'test-secret' } as any, { validateUser: async () => ({ sessionVersion: 0 }) } as any, {} as any);
    await expect(strategy.validate({ sub: '507f1f77bcf86cd799439011' })).rejects.toThrow('Update the app');
  });
  it('accepts legacy claims, records usage, and still enforces password revocation', async () => {
    const auth = { validateUser: vi.fn(async () => ({ email: 'a@example.com', role: 'user', sessionVersion: 0 })) };
    const config = { getOrThrow: () => 'test-secret' };
    const sessions = { validate: vi.fn() };
    const strategy = new JwtStrategy(config as any, auth as any, sessions as any);
    const log = vi.spyOn((strategy as any).logger, 'log').mockImplementation(() => {});
    await expect(strategy.validate({ sub: '507f1f77bcf86cd799439011', sessionVersion: 0 })).resolves.toHaveProperty('role', 'user');
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'legacy_token_used' }));
    await expect(strategy.validate({ sub: '507f1f77bcf86cd799439011', sessionVersion: 1 })).rejects.toThrow();
  });
});
