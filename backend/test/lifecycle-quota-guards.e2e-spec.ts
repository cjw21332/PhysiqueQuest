import { randomBytes } from 'node:crypto';
import { createConnection, Types, type Connection } from 'mongoose';
import { ScanRateLimitGuard } from '../src/common/foodscan/scan-rate-limit.guard.js';
import { ChatRateLimitGuard } from '../src/chat/chat-rate-limit.guard.js';
import { PoseTrackerRateLimitGuard } from '../src/pose-tracker/pose-tracker-rate-limit.guard.js';
import { AuthRateLimit, AuthRateLimitSchema } from '../src/auth/auth-rate-limit.schema.js';

const uri = process.env.PQ_TEST_REPLICA_URI;

// Deterministic quota verification: every guard must spend the generation it
// was authenticated with. consumeQuota treats an undefined expectedGeneration
// as "read the current generation", so a guard that drops the generation would
// bypass the fence and create a user bucket it never validated. Guards run
// after JwtAuthGuard, so req.user is trustworthy at this point.
describe.skipIf(!uri)('quota guards use the authenticated lifecycle generation', () => {
  let connection: Connection, owner: Types.ObjectId, userId: string;

  const config = { value: { rateLimit: { enabled: true, max: 1, windowMs: 3600000 } } } as never;
  const logger = { event: () => {} } as never;
  const contextFor = (user: unknown) => ({
    switchToHttp: () => ({ getRequest: () => ({ user, userId, path: '/nutrition/scan', ip: '127.0.0.1', requestId: 'quota-test' }), getResponse: () => ({ setHeader: () => {} }) }),
  }) as never;

  const scanner = (user: unknown) => new ScanRateLimitGuard(config, logger, connection).canActivate(contextFor(user));
  const chat = (user: unknown) => new ChatRateLimitGuard(connection.model(AuthRateLimit.name, AuthRateLimitSchema)).canActivate(contextFor(user));
  const pose = (user: unknown) => new PoseTrackerRateLimitGuard(connection.model(AuthRateLimit.name, AuthRateLimitSchema)).canActivate(contextFor(user));

  beforeEach(async () => {
    process.env.JWT_SECRET = 'isolated-quota-test-secret';
    connection = await createConnection(uri!, { dbName: `pq_quota_${randomBytes(12).toString('hex')}` }).asPromise();
    owner = new Types.ObjectId(); userId = String(owner);
    await connection.collection('users').insertOne({ _id: owner, email: 'synthetic@example.test', isActive: true, deletedAt: null, purgingAt: null, passwordHash: 'unused' });
    await connection.collection('account_lifecycle').insertOne({ _id: owner, status: 'active', writeVersion: 0, generation: 0 });
  });

  afterEach(async () => {
    if (connection) {
      if (/^pq_quota_[a-f0-9]{24}$/.test(connection.name)) await connection.dropDatabase();
      await connection.close();
    }
  });

  it.each([
    ['scanner', scanner],
    ['chatbot', chat],
    ['pose tracker', pose],
  ] as const)('%s rejects a request authenticated under the pre-deletion generation', async (_name, guard) => {
    await expect(guard({ userId, lifecycleGeneration: 0 })).resolves.toBe(true);
    // Deletion wins the race; generation 0 is stale. The guard must not spend
    // a recovered account's new generation or write another bucket.
    await connection.collection('account_lifecycle').updateOne({ _id: owner }, { $set: { status: 'deleting' }, $inc: { generation: 1, writeVersion: 1 } });
    await expect(guard({ userId, lifecycleGeneration: 0 })).rejects.toThrow();
    expect(await connection.collection('auth_rate_limits').countDocuments({ userId: owner })).toBe(1);
  });

  it.each([
    ['scanner', scanner],
    ['chatbot', chat],
    ['pose tracker', pose],
  ] as const)('%s rejects a request whose lifecycle record vanished (fail closed, no silent creation)', async (_name, guard) => {
    await connection.collection('account_lifecycle').deleteOne({ _id: owner });
    await expect(guard({ userId, lifecycleGeneration: 0 })).rejects.toThrow();
    expect(await connection.collection('auth_rate_limits').countDocuments({ userId: owner })).toBe(0);
  });

  it.each([
    ['scanner', scanner],
    ['chatbot', chat],
    ['pose tracker', pose],
  ] as const)('%s rejects an authenticated request with no generation instead of reading the current one', async (_name, guard) => {
    // An undefined expectedGeneration would read the live generation and
    // bypass the fence, creating a user bucket without validating lifecycle.
    await expect(guard({ userId })).rejects.toThrow();
    expect(await connection.collection('auth_rate_limits').countDocuments({ userId: owner })).toBe(0);
  });

  it.each([
    ['scanner', scanner],
    ['chatbot', chat],
    ['pose tracker', pose],
  ] as const)('%s accepts the generation authenticated after recovery', async (_name, guard) => {
    await connection.collection('account_lifecycle').updateOne({ _id: owner }, { $inc: { generation: 1 } });
    await expect(guard({ userId, lifecycleGeneration: 1 })).resolves.toBe(true);
    expect(await connection.collection('auth_rate_limits').countDocuments({ userId: owner })).toBe(1);
  });
});
