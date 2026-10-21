import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { createConnection, Types, type Connection } from 'mongoose';
import bcrypt from 'bcryptjs';
import { PrivacyService } from '../src/privacy/privacy.service.js';
import { AuthSessionSchema } from '../src/auth/session.schema.js';
import { transformProfile } from '../src/privacy/health-encryption.js';

try { loadEnvFile('.env'); } catch { /* Runner may supply env. */ }
const enabled = process.env.PQ_SECURITY_DB_TEST === '1' && Boolean(process.env.MONGODB_URI);
describe.skipIf(!enabled)('privacy retention on isolated MongoDB', () => {
  const database = `pq_security_test_${randomBytes(8).toString('hex')}`;
  let connection: Connection, service: PrivacyService;
  const collections = ['profiles', 'nutrition', 'workout_sessions', 'progress_entries', 'settings', 'activity', 'notifications', 'safety_alert_events', 'password_recovery_tokens', 'sign_in_events', 'coach_programs', 'auth_sessions', 'future_user_data', 'email_verifications', 'push_devices', 'push_deliveries', 'analysis_jobs', 'analysis_results', 'storage_uploads'];
  beforeAll(async () => {
    vi.stubEnv('HEALTH_DATA_ENCRYPTION_KEY', randomBytes(32).toString('base64'));
    connection = await createConnection(process.env.MONGODB_URI!, { dbName: database, serverSelectionTimeoutMS: 10_000 }).asPromise();
    service = new PrivacyService(connection, { deleteUserObjects: vi.fn(async () => 0) } as any);
    await service.onModuleInit(); service.onModuleDestroy();
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    if (!connection) return;
    try {
      if (!/^pq_security_test_[a-f0-9]{16}$/.test(database) || connection.name !== database) throw Error('Unexpected database');
      await connection.dropDatabase();
    } finally { await connection.close(); }
  });
  it('revokes immediately, recovers only during grace, exports health and purges every owned collection without touching another user', async () => {
    const db = connection.db!, id = new Types.ObjectId(), other = new Types.ObjectId();
    await db.collection('users').insertMany([{ _id: id, email: 'synthetic@example.invalid', passwordHash: await bcrypt.hash('synthetic-password', 4), isActive: true, sessionVersion: 0 }, { _id: other, isActive: true }]);
    for (const name of collections) {
      const record = { userId: id, healthNotes: 'synthetic health', contactPhone: 'synthetic contact', ...(name === 'push_devices' ? { token: 'synthetic-private-push-token' } : {}) };
      await db.collection(name).insertMany([name === 'profiles' ? transformProfile(record, true) : record, { userId: other }]);
    }
    await db.collection('leaderboard_snapshots').insertMany([{ subjectId: id }, { subjectId: other }]);
    const exported = await service.exportData(String(id));
    expect(JSON.stringify(exported)).toContain('synthetic health');
    expect(JSON.stringify(exported)).not.toContain('passwordHash');
    expect(JSON.stringify(exported)).not.toContain('pqenc:v1:');
    expect(JSON.stringify(exported)).not.toContain('synthetic-private-push-token');
    const deletion = await service.requestDeletion(String(id), 'synthetic-password');
    expect(deletion.purgeAfter.getTime()).toBeGreaterThan(Date.now() + 29 * 86400_000);
    expect((await db.collection('users').findOne({ _id: id }))?.isActive).toBe(false);
    expect((await db.collection('auth_sessions').findOne({ userId: id }))?.revokedAt).toBeInstanceOf(Date);
    expect((await db.collection('users').findOne({ _id: id }))?.sessionVersion).toBe(1);
    await service.purgeUser(String(id));
    expect(await db.collection('users').findOne({ _id: id })).not.toBeNull();
    await expect(service.recover('synthetic@example.invalid', 'wrong-password')).rejects.toThrow();
    await expect(service.recover('synthetic@example.invalid', 'synthetic-password')).resolves.toEqual({ recovered: true });
    expect((await db.collection('users').findOne({ _id: id }))?.sessionVersion).toBe(2);
    await service.requestDeletion(String(id), 'synthetic-password');
    await db.collection('users').updateOne({ _id: id }, { $set: { purgeAfter: new Date(Date.now() - 1) } });
    await expect(service.recover('synthetic@example.invalid', 'synthetic-password')).rejects.toThrow();
    await service.tick();
    expect(await db.collection('users').findOne({ _id: id })).toBeNull();
    for (const name of collections) {
      expect(await db.collection(name).countDocuments({ userId: id })).toBe(0);
      expect(await db.collection(name).countDocuments({ userId: other })).toBe(1);
    }
    expect(await db.collection('leaderboard_snapshots').countDocuments({ subjectId: id })).toBe(0);
    expect(await db.collection('audit_logs').countDocuments({ actorId: String(id) })).toBe(0);
    expect(await db.collection('audit_logs').countDocuments({ action: 'account_purged' })).toBe(1);
    const job = await db.collection('background_jobs').findOne({ status: 'completed' });
    expect(job?.payload).toEqual({});
    expect(job?.purgeAt.getTime() - job?.completedAt.getTime()).toBe(24 * 3600_000);
    await service.tick();
    expect(await db.collection('audit_logs').countDocuments({ action: 'account_purged' })).toBe(1);
  }, 30_000);
  it('enforces queue payloads and expires records with an explicit sweep as well as TTL indexes', async () => {
    const db = connection.db!, past = new Date(Date.now() - 1000);
    await expect(service.enqueue('bad', 'account-purge', { email: 'synthetic@example.invalid' }, new Date())).rejects.toThrow('IDs only');
    await db.collection('audit_logs').insertOne({ action: 'expired', purgeAt: past });
    await db.collection('audit_logs').insertOne({ action: 'cold', cold: false, hotUntil: past, purgeAt: new Date(Date.now() + 86400_000) });
    await db.collection('background_jobs').insertOne({ key: 'expired', status: 'failed', purgeAt: past });
    await db.collection('auth_sessions').insertOne({ purgeAt: past });
    await service.tick();
    expect(await db.collection('audit_logs').findOne({ action: 'expired' })).toBeNull();
    expect((await db.collection('audit_logs').findOne({ action: 'cold' }))?.cold).toBe(true);
    expect(await db.collection('background_jobs').findOne({ key: 'expired' })).toBeNull();
    expect(await db.collection('auth_sessions').countDocuments({ purgeAt: past })).toBe(0);
    for (const name of ['audit_logs', 'background_jobs']) expect((await db.collection(name).indexes()).some(index => index.key.purgeAt === 1 && index.expireAfterSeconds === 0)).toBe(true);
    expect(AuthSessionSchema.indexes()).toContainEqual([{ purgeAt: 1 }, { expireAfterSeconds: 0 }]);
  });
});
