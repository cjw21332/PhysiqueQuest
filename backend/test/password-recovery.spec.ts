import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { PasswordRecoveryService } from '../src/auth/password-recovery.service.js';
import type { EmailDeliveryProvider } from '../src/providers/email-delivery.provider.js';

describe('password recovery', () => {
  it('returns an account-neutral unavailable response without storing tokens', async () => {
    const findOne = vi.fn();
    const provider = { isAvailable: () => false, sendPasswordReset: vi.fn() } as unknown as EmailDeliveryProvider;
    const service = new PasswordRecoveryService({ findOne } as any, {} as any, provider);
    expect(await service.request('unknown@example.com')).toEqual({ accepted: true, delivery: 'unavailable' });
    expect(findOne).not.toHaveBeenCalled();
  });

  it('stores only a token hash and confirms one-time password changes', async () => {
    const user = { _id: new Types.ObjectId(), email: 'member@example.com' };
    const created: any[] = [];
    const updates: any[] = [];
    const tokens = { deleteMany: vi.fn(), create: vi.fn(async item => { created.push(item); }), findOneAndUpdate: vi.fn(async (filter, update) => { const item = created.find(entry => entry.tokenHash === filter.tokenHash && !entry.usedAt); if (!item) return null; item.usedAt = update.$set.usedAt; return item; }) };
    const users = { findOne: vi.fn(async () => user), updateOne: vi.fn(async (...args) => { updates.push(args); return { matchedCount: 1 }; }) };
    const provider = { isAvailable: () => true, sendPasswordReset: vi.fn(async () => true) } as unknown as EmailDeliveryProvider;
    const service = new PasswordRecoveryService(users as any, tokens as any, provider);
    const response = await service.request(' MEMBER@example.com ');
    expect(response).toEqual({ accepted: true, delivery: 'queued' });
    const rawToken = (provider.sendPasswordReset as any).mock.calls[0][1] as string;
    expect(created[0].tokenHash).not.toBe(rawToken);
    expect(created[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    await service.confirm(rawToken, 'StrongPass1');
    expect(updates).toHaveLength(1);
    expect(await bcrypt.compare('StrongPass1', updates[0][1].$set.passwordHash)).toBe(true);
    await expect(service.confirm(rawToken, 'OtherPass2')).rejects.toThrow();
  });
});
