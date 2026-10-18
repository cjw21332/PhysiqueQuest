import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { PasswordRecoveryService } from '../src/auth/password-recovery.service.js';
import { JwtStrategy } from '../src/auth/jwt.strategy.js';
import { validate } from 'class-validator';
import { PasswordResetConfirmDto, PasswordResetVerifyDto } from '../src/auth/dto/password-recovery.dto.js';
vi.mock('node:crypto', async original => ({ ...await original<typeof import('node:crypto')>(), randomInt: () => 123456 }));
const A = new Types.ObjectId(), B = new Types.ObjectId();
const equal = (a: any, b: any) => String(a) === String(b);
function matches(row: any, filter: any): boolean {
  return Object.entries(filter).every(([key, value]: any) => {
    const actual = row[key];
    if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Types.ObjectId))
      return Object.entries(value).every(([op, bound]: any) => op === '$gt' ? actual > bound : op === '$lt' ? actual < bound : op === '$lte' ? actual <= bound : op === '$ne' ? !equal(actual, bound) : op === '$in' ? bound.some((item: any) => item === null ? actual == null : equal(actual, item)) : false);
    return value === null ? actual == null : equal(actual, value);
  });
}
function apply(row: any, update: any) {
  Object.assign(row, update.$set);
  for (const [key, value] of Object.entries(update.$inc ?? {})) row[key] = (row[key] ?? 0) + Number(value);
}
function fixture() {
  const rows: any[] = [], buckets: any[] = [];
  const accounts = [{ _id: A, email: 'a@example.com', isActive: true, sessionVersion: 0 }, { _id: B, email: 'b@example.com', isActive: true, sessionVersion: 0 }];
  const users = { findOne: vi.fn(async filter => accounts.find(row => matches(row, filter))), updateOne: vi.fn(async (filter, update) => { const row = accounts.find(item => matches(item, filter)); if (!row) return { matchedCount: 0 }; apply(row, update); return { matchedCount: 1 }; }) };
  const session = { endSession: vi.fn(), withTransaction: async (fn: () => Promise<void>) => {
    const backup = rows.map(row => ({ ...row })), accountBackup = accounts.map(row => ({ ...row }));
    try { await fn(); } catch (error) { rows.splice(0, rows.length, ...backup); accounts.forEach((row, i) => Object.assign(row, accountBackup[i])); throw error; }
  } };
  const tokens = { db: { startSession: async () => session }, create: vi.fn(async row => { rows.push({ _id: new Types.ObjectId(), ...row }); }),
    updateMany: vi.fn(async (filter, update) => { rows.filter(row => matches(row, filter)).forEach(row => apply(row, update)); }),
    findOneAndUpdate: vi.fn(async (filter, update) => { const row = rows.find(row => matches(row, filter)); if (!row) return null; apply(row, update); return { ...row }; }) };
  const limits = { findOneAndUpdate: vi.fn(async (filter, update, options) => {
    let row = buckets.find(item => matches(item, filter));
    if (!row && options?.upsert) {
      if (buckets.some(item => item._id === filter._id)) throw Object.assign(new Error('duplicate'), { code: 11000 });
      row = { _id: filter._id, ...update.$setOnInsert }; buckets.push(row);
    }
    if (!row) return null; apply(row, update); return { ...row };
  }) };
  const email = { isAvailable: () => true, diagnostics: () => ({}), sendPasswordReset: vi.fn(async () => ({ ok: true })) };
  const config = { getOrThrow: () => 'test-secret-at-least-32-characters-long' };
  const service = new PasswordRecoveryService(users as any, tokens as any, email as any, limits as any, config as any);
  return { service, rows, accounts, users, tokens, email, buckets, limits, session };
}
beforeEach(() => { vi.stubEnv('NODE_ENV', 'production'); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-18T05:00:00Z')); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
describe('request-bound recovery', () => {
  it('returns neutral opaque IDs and never exposes production codes', async () => {
    const f = fixture();
    const known = await f.service.request(' A@example.com ', 'one');
    const unknown = await f.service.request('unknown@example.com', 'two');
    expect(known).toMatchObject({ accepted: true, delivery: 'queued', requestId: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect({ ...known, requestId: '' }).toEqual({ ...unknown, requestId: '' });
    expect(known).not.toHaveProperty('code');
    expect(f.rows[0].tokenHash).not.toContain('123456');
  });
  it('isolates equal six-digit codes and consumes a grant once', async () => {
    const f = fixture(), a = await f.service.request('a@example.com'), b = await f.service.request('b@example.com');
    expect(f.rows[0].tokenHash).not.toBe(f.rows[1].tokenHash);
    const grant = await f.service.verify(a.requestId, '123456');
    expect(grant.resetToken).toMatch(/^[a-f0-9]{64}$/);
    await f.service.confirm(grant.resetToken, 'NewStrong1');
    expect(f.accounts[0].sessionVersion).toBe(1); expect(f.accounts[1].sessionVersion).toBe(0);
    expect(await bcrypt.compare('NewStrong1', (f.accounts[0] as any).passwordHash)).toBe(true);
    await expect(f.service.confirm(grant.resetToken, 'Another1')).rejects.toThrow();
    await expect(f.service.verify(a.requestId, '123456')).rejects.toThrow();
    expect((await f.service.verify(b.requestId, '123456')).verified).toBe(true);
  });
  it('rejects cross-request code pairing and caps attempts at five', async () => {
    const f = fixture(), a = await f.service.request('a@example.com');
    for (let i = 0; i < 5; i++) await expect(f.service.verify(a.requestId, '000000')).rejects.toThrow();
    await expect(f.service.verify(a.requestId, '123456')).rejects.toThrow();
    expect(f.rows[0].attempts).toBe(5);
  });
  it('requires a new code after expiration or resend, and enforces a rolling cooldown', async () => {
    const f = fixture(), first = await f.service.request('a@example.com');
    vi.setSystemTime(Date.now() + 59_000);
    await expect(f.service.request('a@example.com')).rejects.toThrow('60 seconds');
    vi.setSystemTime(Date.now() + 1001);
    const next = await f.service.request('a@example.com');
    await expect(f.service.verify(first.requestId, '123456')).rejects.toThrow();
    vi.setSystemTime(Date.now() + 600_001);
    await expect(f.service.verify(next.requestId, '123456')).rejects.toThrow();
  });
  it('expires reset authorizations and disallows verifying a request twice', async () => {
    const f = fixture(), request = await f.service.request('a@example.com');
    const grant = await f.service.verify(request.requestId, '123456');
    await expect(f.service.verify(request.requestId, '123456')).rejects.toThrow();
    vi.setSystemTime(Date.now() + 300_001);
    await expect(f.service.confirm(grant.resetToken, 'NewStrong1')).rejects.toThrow();
  });
  it('rolls back grant consumption if the password write fails', async () => {
    const f = fixture(), request = await f.service.request('a@example.com'), grant = await f.service.verify(request.requestId, '123456');
    f.users.updateOne.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(f.service.confirm(grant.resetToken, 'NewStrong1')).rejects.toThrow('database unavailable');
    expect(f.rows[0].usedAt).toBeNull();
    await f.service.confirm(grant.resetToken, 'NewStrong1');
    expect(f.accounts[0].sessionVersion).toBe(1); expect(f.session.endSession).toHaveBeenCalledTimes(2);
  });
  it('uses shared IP limits, independent of a service instance', async () => {
    const f = fixture();
    for (let i = 0; i < 20; i++) await f.service.request(`unknown${i}@example.com`, 'shared-ip');
    await expect(f.service.request('other@example.com', 'shared-ip')).rejects.toThrow('Too many');
  });
  it('does not create recovery records without a production email provider', async () => {
    const f = fixture(); f.email.isAvailable = () => false;
    const response = await f.service.request('a@example.com');
    expect(response.delivery).toBe('unavailable'); expect(f.tokens.create).not.toHaveBeenCalled(); expect(response).not.toHaveProperty('code');
  });
  it('invalidates a request after delivery failure without revealing account existence', async () => {
    const f = fixture(); f.email.sendPasswordReset.mockResolvedValueOnce({ ok: false } as any);
    const response = await f.service.request('a@example.com');
    expect(response.delivery).toBe('queued'); expect(f.rows[0].usedAt).toBeTruthy();
  });
  it('rejects legacy code-only DTOs', async () => {
    expect(await validate(Object.assign(new PasswordResetVerifyDto(), { code: '123456' }))).not.toHaveLength(0);
    expect(await validate(Object.assign(new PasswordResetConfirmDto(), { code: '123456', password: 'NewStrong1' }))).not.toHaveLength(0);
  });
});
describe('signed-in password changes', () => {
  it('uses the stored account email and changes only that account, consuming the grant once', async () => {
    const f = fixture(), request = await f.service.requestChange(String(A));
    expect(f.email.sendPasswordReset).toHaveBeenCalledWith('a@example.com', '123456');
    expect(request).toMatchObject({ email: 'a@example.com' }); expect(request).not.toHaveProperty('code');
    const grant = await f.service.verifyChange(String(A), request.requestId, '123456');
    await expect(f.service.confirmChange(String(B), grant.resetToken, 'NewStrong1')).rejects.toThrow();
    expect(f.rows[0].usedAt).toBeNull();
    await f.service.confirmChange(String(A), grant.resetToken, 'NewStrong1');
    expect(f.accounts[0].sessionVersion).toBe(1); expect(f.accounts[1].sessionVersion).toBe(0);
    expect(await bcrypt.compare('NewStrong1', (f.accounts[0] as any).passwordHash)).toBe(true);
    await expect(f.service.confirmChange(String(A), grant.resetToken, 'Another1')).rejects.toThrow();
  });
  it('rejects another account code without consuming the owner attempt budget', async () => {
    const f = fixture(), request = await f.service.requestChange(String(A));
    await expect(f.service.verifyChange(String(B), request.requestId, '123456')).rejects.toThrow();
    expect(f.rows[0].attempts).toBe(0);
    await expect(f.service.verifyChange(String(A), request.requestId, '123456')).resolves.toMatchObject({ verified: true });
  });
  it('does not exchange codes or grants with the public recovery flow', async () => {
    const f = fixture(), request = await f.service.requestChange(String(A));
    await expect(f.service.verify(request.requestId, '123456')).rejects.toThrow();
    const grant = await f.service.verifyChange(String(A), request.requestId, '123456');
    await expect(f.service.confirm(grant.resetToken, 'NewStrong1')).rejects.toThrow();
    const reset = await f.service.request('b@example.com');
    await expect(f.service.verifyChange(String(B), reset.requestId, '123456')).rejects.toThrow();
    const resetGrant = await f.service.verify(reset.requestId, '123456');
    await expect(f.service.confirmChange(String(B), resetGrant.resetToken, 'NewStrong1')).rejects.toThrow();
    expect(f.accounts.every(account => account.sessionVersion === 0)).toBe(true);
  });
  it.each(['email', 'sessionVersion'])('rejects authorization after account %s changes', async field => {
    const f = fixture(), request = await f.service.requestChange(String(A));
    const grant = await f.service.verifyChange(String(A), request.requestId, '123456');
    if (field === 'email') f.accounts[0].email = 'new@example.com'; else f.accounts[0].sessionVersion++;
    await expect(f.service.confirmChange(String(A), grant.resetToken, 'NewStrong1')).rejects.toThrow();
    expect(f.rows[0].usedAt).toBeNull(); expect(f.users.updateOne).not.toHaveBeenCalled();
  });
  it('supports legacy accounts without a stored session version', async () => {
    const f = fixture(); delete (f.accounts[0] as any).sessionVersion;
    const request = await f.service.requestChange(String(A));
    const grant = await f.service.verifyChange(String(A), request.requestId, '123456');
    await f.service.confirmChange(String(A), grant.resetToken, 'NewStrong1');
    expect(f.accounts[0].sessionVersion).toBe(1);
  });
  it('requires email delivery even in development and rejects inactive accounts', async () => {
    const f = fixture(); vi.stubEnv('NODE_ENV', 'development'); f.email.isAvailable = () => false;
    const response = await f.service.requestChange(String(A));
    expect(response).toMatchObject({ delivery: 'unavailable' }); expect(response).not.toHaveProperty('code');
    expect(f.tokens.create).not.toHaveBeenCalled();
    f.accounts[1].isActive = false;
    await expect(f.service.requestChange(String(B))).rejects.toThrow();
  });
});
it('rejects old login sessions after reset and keeps migration version zero compatible', async () => {
  const config = { getOrThrow: () => 'secret' }, auth = { validateUser: vi.fn(async () => ({ email: 'stored@example.com', role: 'user', sessionVersion: 0 })) };
  const strategy = new JwtStrategy(config as any, auth as any);
  await expect(strategy.validate({ sub: String(A), email: 'stale@example.com' })).resolves.toMatchObject({ userId: String(A), email: 'stored@example.com' });
  auth.validateUser.mockResolvedValue({ email: 'stored@example.com', role: 'user', sessionVersion: 1 });
  await expect(strategy.validate({ sub: String(A), sessionVersion: 0 })).rejects.toThrow('Session expired');
  await expect(strategy.validate({ sub: String(A), sessionVersion: 1 })).resolves.toMatchObject({ role: 'user' });
});
