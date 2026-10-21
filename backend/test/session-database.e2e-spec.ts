import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { createConnection, type Connection } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { AuthSession, AuthSessionSchema } from '../src/auth/session.schema.js';
import { User, UserSchema } from '../src/auth/schemas/user.schema.js';
import { SessionService } from '../src/auth/session.service.js';

try { loadEnvFile('.env'); } catch { /* Environment may be supplied by the runner. */ }
const enabled = process.env.PQ_SECURITY_DB_TEST === '1' && Boolean(process.env.MONGODB_URI);
describe.skipIf(!enabled)('real MongoDB refresh rotation', () => {
  const database = `pq_security_test_${randomBytes(8).toString('hex')}`;
  let connection: Connection;
  beforeAll(async () => { connection = await createConnection(process.env.MONGODB_URI!, { dbName: database, serverSelectionTimeoutMS: 10_000 }).asPromise(); });
  afterAll(async () => {
    if (!connection) return;
    try {
      if (!/^pq_security_test_[a-f0-9]{16}$/.test(database) || connection.name !== database) throw Error('Unexpected test database');
      await connection.dropDatabase();
    } finally { await connection.close(); }
  });
  it('atomically rotates once under concurrent calls, revokes replay and invalidates password-changed users', async () => {
    const sessions = connection.model(AuthSession.name, AuthSessionSchema), users = connection.model(User.name, UserSchema);
    await Promise.all([sessions.init(), users.init()]);
    const user = await users.create({ name: 'Synthetic session', email: 'session@example.invalid', passwordHash: 'not-a-real-password' });
    const service = new SessionService(sessions, users, new JwtService({ secret: randomBytes(32).toString('hex') }));
    const first = await service.issue(user);
    const results = await Promise.allSettled([service.refresh(first.refresh_token), service.refresh(first.refresh_token)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const successful = results.find(result => result.status === 'fulfilled');
    if (successful?.status !== 'fulfilled') throw Error('Expected exactly one rotation');
    await expect(service.refresh(successful.value.refresh_token)).rejects.toThrow();
    const second = await service.issue(user);
    await users.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } });
    await expect(service.refresh(second.refresh_token)).rejects.toThrow();
  });
});
