import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { createConnection, type Connection } from 'mongoose';
import { EmailVerificationService } from '../src/auth/email-verification.service.js';
import { consoleMailbox } from '../src/providers/mail.provider.js';
try { loadEnvFile('.env'); } catch { /* Runner may supply env. */ }
describe.skipIf(process.env.PQ_SECURITY_DB_TEST !== '1' || !process.env.MONGODB_URI)('verification tokens on real MongoDB', () => {
  const database = `pq_security_test_${randomBytes(8).toString('hex')}`;
  let connection: Connection, service: EmailVerificationService;
  beforeAll(async () => {
    vi.stubEnv('MAIL_PROVIDER', 'console'); vi.stubEnv('NODE_ENV', 'test');
    connection = await createConnection(process.env.MONGODB_URI!, { dbName: database }).asPromise();
    service = new EmailVerificationService(connection); await service.onModuleInit();
  });
  afterAll(async () => {
    vi.unstubAllEnvs(); consoleMailbox.messages.length = 0;
    if (!connection) return;
    try { if (connection.name !== database || !/^pq_security_test_[a-f0-9]{16}$/.test(database)) throw Error('Unsafe database'); await connection.dropDatabase(); }
    finally { await connection.close(); }
  });
  it('is neutral to unknown addresses, throttles resends, and consumes a link once', async () => {
    const db = connection.db!;
    await db.collection('users').insertOne({ email: 'synthetic@example.invalid', isActive: true, emailVerified: false });
    expect(await service.request('unknown@example.invalid')).toEqual({ accepted: true });
    expect(await service.request('synthetic@example.invalid')).toEqual({ accepted: true });
    await expect(service.request('synthetic@example.invalid')).rejects.toThrow('Wait 60');
    const token = consoleMailbox.messages.at(-1)!.token;
    expect(JSON.stringify(await db.collection('email_verifications').findOne({}))).not.toContain(token);
    expect(await service.confirm(token)).toEqual({ verified: true });
    await expect(service.confirm(token)).rejects.toThrow('invalid or expired');
    expect((await db.collection('users').findOne({ email: 'synthetic@example.invalid' }))?.emailVerified).toBe(true);
    await db.collection('users').insertOne({ email: 'expired@example.invalid', isActive: true });
    await service.request('expired@example.invalid');
    const expired = consoleMailbox.messages.at(-1)!.token;
    await db.collection('email_verifications').updateMany({ usedAt: null }, { $set: { expiresAt: new Date(0) } });
    await expect(service.confirm(expired)).rejects.toThrow('invalid or expired');
  }, 30_000);
});
