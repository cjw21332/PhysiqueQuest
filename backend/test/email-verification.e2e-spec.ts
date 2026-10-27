import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { createConnection, type Connection } from 'mongoose';
import { EmailVerificationService } from '../src/auth/email-verification.service.js';
import { consoleMailbox } from '../src/providers/mail.provider.js';
import { EmailDeliveryProvider } from '../src/providers/email-delivery.provider.js';
import { ConfigService } from '@nestjs/config';
try { loadEnvFile('.env'); } catch { /* Runner may supply env. */ }
describe.skipIf(process.env.PQ_SECURITY_DB_TEST !== '1' || !process.env.MONGODB_URI)('verification tokens on real MongoDB', () => {
  const database = `pq_security_test_${randomBytes(8).toString('hex')}`;
  let connection: Connection, service: EmailVerificationService;
  beforeAll(async () => {
    vi.stubEnv('MAIL_PROVIDER', 'console'); vi.stubEnv('NODE_ENV', 'test');
    connection = await createConnection(process.env.MONGODB_URI!, { dbName: database }).asPromise();
    service = new EmailVerificationService(connection, new EmailDeliveryProvider(new ConfigService())); await service.onModuleInit();
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
    expect(await service.request('unknown@example.invalid')).toMatchObject({ accepted: true });
    expect(await service.request('synthetic@example.invalid')).toMatchObject({ accepted: true });
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
  it('accepts only the current registration code once and limits guesses', async () => {
    const email = 'signup@example.invalid';
    const { requestId } = await service.requestRegistration(email);
    const code = consoleMailbox.messages.at(-1)!.token;
    expect(JSON.stringify(await connection.db!.collection('registration_codes').findOne({ requestId }))).not.toContain(code);
    await expect(service.consumeRegistration(email, requestId, '000000')).rejects.toThrow('invalid or expired');
    await expect(service.consumeRegistration('other@example.invalid', requestId, code)).rejects.toThrow('invalid or expired');
    await service.consumeRegistration(email, requestId, code);
    await expect(service.consumeRegistration(email, requestId, code)).rejects.toThrow('invalid or expired');
    const other = await service.requestRegistration('expired-signup@example.invalid');
    const expiredCode = consoleMailbox.messages.at(-1)!.token;
    await connection.db!.collection('registration_codes').updateOne({ requestId: other.requestId }, { $set: { expiresAt: new Date(0) } });
    await expect(service.consumeRegistration('expired-signup@example.invalid', other.requestId, expiredCode)).rejects.toThrow('invalid or expired');
    const limited = await service.requestRegistration('limited@example.invalid');
    const validCode = consoleMailbox.messages.at(-1)!.token;
    for (let i = 0; i < 5; i++) await expect(service.consumeRegistration('limited@example.invalid', limited.requestId, '000000')).rejects.toThrow('invalid or expired');
    await expect(service.consumeRegistration('limited@example.invalid', limited.requestId, validCode)).rejects.toThrow('invalid or expired');
  });
  it('verifies only the signed-in account matching the code email', async () => {
    const email = 'account-verification@example.invalid';
    const user = await connection.db!.collection('users').insertOne({ email, isActive: true, emailVerified: false });
    const { requestId } = await service.requestRegistration(email);
    const code = consoleMailbox.messages.at(-1)!.token;
    await expect(service.confirmAccount(String(user.insertedId), 'other@example.invalid', requestId, code)).rejects.toThrow('invalid or expired');
    expect((await connection.db!.collection('users').findOne({ _id: user.insertedId }))?.emailVerified).toBe(false);
    await service.confirmAccount(String(user.insertedId), email, requestId, code);
    expect((await connection.db!.collection('users').findOne({ _id: user.insertedId }))?.emailVerified).toBe(true);
    await expect(service.confirmAccount(String(user.insertedId), email, requestId, code)).rejects.toThrow('invalid or expired');
  });
});
