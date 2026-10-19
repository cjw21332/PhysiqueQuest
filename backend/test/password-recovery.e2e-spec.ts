import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createConnection, type Connection } from 'mongoose';
import bcrypt from 'bcryptjs';
import { PasswordRecoveryService } from '../src/auth/password-recovery.service.js';
import { User, UserSchema } from '../src/auth/schemas/user.schema.js';
import { RecoveryToken, RecoveryTokenSchema } from '../src/auth/recovery-token.schema.js';
import { AuthRateLimit, AuthRateLimitSchema } from '../src/auth/auth-rate-limit.schema.js';
import { EmailDeliveryProvider } from '../src/providers/email-delivery.provider.js';

try { loadEnvFile('.env'); } catch { /* Explicit environment configuration is also supported. */ }
const enabled = process.env.PQ_RECOVERY_DB_TEST === '1' && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)('Recovery transactions on an isolated MongoDB database', () => {
  const database = `pq_recovery_test_${randomBytes(8).toString('hex')}`;
  let connection: Connection;
  beforeAll(async () => {
    connection = await createConnection(process.env.MONGODB_URI!, { dbName: database, serverSelectionTimeoutMS: 15_000 }).asPromise();
  });
  afterAll(async () => {
    if (!connection) return;
    try {
      // Never clean a database selected by an environment URL or arbitrary input.
      if (!/^pq_recovery_test_[a-f0-9]{16}$/.test(database) || connection.name !== database) throw new Error('Unexpected test database');
      await connection.dropDatabase();
    } finally { await connection.close(); }
  });
  it('binds codes, atomically consumes a grant once, revokes sessions and rolls back on failure', async () => {
    const users = connection.model(User.name, UserSchema);
    const tokens = connection.model(RecoveryToken.name, RecoveryTokenSchema);
    const limits = connection.model(AuthRateLimit.name, AuthRateLimitSchema);
    await Promise.all([users.init(), tokens.init(), limits.init()]);
    const sent = new Map<string, string>();
    const email = { isAvailable: () => true, sendPasswordReset: async (address: string, code: string) => { sent.set(address, code); return { ok: true }; } };
    const service = new PasswordRecoveryService(users, tokens, email as unknown as EmailDeliveryProvider, limits, new ConfigService({ JWT_SECRET: randomBytes(32).toString('hex') }));
    const first = await users.create({ name: 'Synthetic test', email: 'recovery-one@example.invalid', passwordHash: 'original' });
    const second = await users.create({ name: 'Synthetic test', email: 'recovery-two@example.invalid', passwordHash: 'original' });
    const a = await service.request(first.email, 'synthetic-ip-1');
    const b = await service.request(second.email, 'synthetic-ip-2');
    await expect(service.verify('0'.repeat(64), sent.get(first.email)!, 'synthetic-ip-1')).rejects.toThrow();
    await expect(service.request(first.email, 'synthetic-ip-3')).rejects.toThrow(/60 seconds/);
    const verified = await service.verify(a.requestId, sent.get(first.email)!, 'synthetic-ip-1');
    const results = await Promise.allSettled([
      service.confirm(verified.resetToken, 'NewPass123!', 'synthetic-ip-1'),
      service.confirm(verified.resetToken, 'OtherPass123!', 'synthetic-ip-2'),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const updated = await users.findById(first._id).select('+passwordHash').lean();
    expect(updated!.sessionVersion).toBe(1);
    expect(await bcrypt.compare(results[0].status === 'fulfilled' ? 'NewPass123!' : 'OtherPass123!', updated!.passwordHash)).toBe(true);
    await expect(service.confirm(verified.resetToken, 'RetryPass123!', 'synthetic-ip-1')).rejects.toThrow();
    const otherGrant = await service.verify(b.requestId, sent.get(second.email)!, 'synthetic-ip-2');
    await users.updateOne({ _id: second._id }, { $set: { isActive: false } });
    await expect(service.confirm(otherGrant.resetToken, 'NewPass123!', 'synthetic-ip-2')).rejects.toThrow();
    expect((await tokens.findOne({ requestId: b.requestId }).lean())!.usedAt).toBeNull();
    await users.updateOne({ _id: second._id }, { $set: { isActive: true } });
    await expect(service.confirm(otherGrant.resetToken, 'NewPass123!', 'synthetic-ip-2')).resolves.toEqual({ updated: true });
  });
  it('binds change email, code and transaction to one user and supports legacy version-zero accounts', async () => {
    const users = connection.model(User.name, UserSchema), tokens = connection.model(RecoveryToken.name, RecoveryTokenSchema), limits = connection.model(AuthRateLimit.name, AuthRateLimitSchema);
    const sent = new Map<string, string>();
    const email = { isAvailable: () => true, sendPasswordReset: async (address: string, code: string) => { sent.set(address, code); return { ok: true }; } };
    const service = new PasswordRecoveryService(users, tokens, email as unknown as EmailDeliveryProvider, limits, new ConfigService({ JWT_SECRET: randomBytes(32).toString('hex') }));
    const owner = await users.create({ name: 'Synthetic owner', email: 'change-owner@example.invalid', passwordHash: 'original' });
    const other = await users.create({ name: 'Synthetic other', email: 'change-other@example.invalid', passwordHash: 'original' });
    await users.collection.updateOne({ _id: owner._id }, { $unset: { sessionVersion: '' } });
    const change = await service.requestChange(String(owner._id), 'synthetic-change-ip');
    expect([...sent.keys()]).toEqual([owner.email]);
    const code = sent.get(owner.email)!;
    await expect(service.verifyChange(String(other._id), change.requestId, code)).rejects.toThrow();
    await expect(service.verify(change.requestId, code)).rejects.toThrow();
    const grant = await service.verifyChange(String(owner._id), change.requestId, code);
    await expect(service.confirmChange(String(other._id), grant.resetToken, 'NewPass123!')).rejects.toThrow();
    await expect(service.confirm(grant.resetToken, 'NewPass123!')).rejects.toThrow();
    expect((await tokens.findOne({ requestId: change.requestId }).lean())!.usedAt).toBeNull();
    await service.confirmChange(String(owner._id), grant.resetToken, 'NewPass123!');
    const updated = await users.findById(owner._id).select('+passwordHash').lean();
    expect(await bcrypt.compare('NewPass123!', updated!.passwordHash)).toBe(true); expect(updated!.sessionVersion).toBe(1);
    expect((await users.findById(other._id).select('+passwordHash').lean())!.passwordHash).toBe('original');
    await expect(service.confirmChange(String(owner._id), grant.resetToken, 'OtherPass123!')).rejects.toThrow();
  });
});
