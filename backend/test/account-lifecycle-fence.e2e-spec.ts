import { randomBytes } from 'node:crypto';
import { createConnection, Types } from 'mongoose';
import { AccountLifecycleFence } from '../src/privacy/account-lifecycle-fence.js';

const uri = process.env.PQ_TEST_REPLICA_URI;

describe.skipIf(!uri)('account lifecycle transaction primitive on a replica set', () => {
  const dbName = `pq_fence_test_${randomBytes(12).toString('hex')}`;
  let connection: Awaited<ReturnType<ReturnType<typeof createConnection>['asPromise']>>;
  let fence: AccountLifecycleFence;
  beforeAll(async () => {
    connection = await createConnection(uri!, { dbName, serverSelectionTimeoutMS: 5000 }).asPromise();
    const hello = await connection.db!.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Replica set or mongos required');
    fence = new AccountLifecycleFence(connection);
  });
  afterAll(async () => {
    if (!connection) return;
    try { if (/^pq_fence_test_[a-f0-9]{24}$/.test(connection.name)) await connection.dropDatabase(); }
    finally { await connection.close(); }
  });

  it('rejects missing and deleting lifecycle records without creating user data', async () => {
    const owner = new Types.ObjectId();
    const save = () => fence.withActiveWrite(String(owner), async session => {
      await connection.collection('nutrition').insertOne({ userId: owner }, { session });
    });
    await expect(save()).rejects.toThrow();
    await connection.collection('account_lifecycle').insertOne({ _id: owner, status: 'active', writeVersion: 0 });
    expect(await fence.beginDeletion(String(owner))).toBe(true);
    await expect(save()).rejects.toThrow();
    expect(await connection.collection('nutrition').countDocuments({ userId: owner })).toBe(0);
    expect(await connection.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ status: 'deleting' });
  });

  it('does not commit an in-flight transaction after the deletion transition wins', async () => {
    const owner = new Types.ObjectId();
    await connection.collection('account_lifecycle').insertOne({ _id: owner, status: 'active', writeVersion: 0 });
    let entered!: () => void, resume!: () => void;
    const enteredPromise = new Promise<void>(resolve => { entered = resolve; });
    const resumePromise = new Promise<void>(resolve => { resume = resolve; });
    // Capture the transaction's snapshot before deletion takes the lifecycle write.
    const session = await connection.startSession();
    const attempt = session.withTransaction(async () => {
      await connection.collection('account_lifecycle').findOne({ _id: owner }, { session });
      entered();
      await resumePromise;
      const changed = await connection.collection('account_lifecycle').updateOne({ _id: owner, status: 'active' }, { $inc: { writeVersion: 1 } }, { session });
      if (!changed.matchedCount) throw new Error('inactive');
      await connection.collection('nutrition').insertOne({ userId: owner }, { session });
    });
    await enteredPromise;
    expect(await fence.beginDeletion(String(owner))).toBe(true);
    resume();
    await expect(attempt).rejects.toThrow();
    await session.endSession();
    expect(await connection.collection('nutrition').countDocuments({ userId: owner })).toBe(0);
  });

  it('commits an active write and rolls back a failed transaction', async () => {
    const owner = new Types.ObjectId();
    await connection.collection('account_lifecycle').insertOne({ _id: owner, status: 'active', writeVersion: 0 });
    await fence.withActiveWrite(String(owner), async session => {
      await connection.collection('nutrition').insertOne({ userId: owner, marker: 'committed' }, { session });
    });
    await expect(fence.withActiveWrite(String(owner), async session => {
      await connection.collection('nutrition').insertOne({ userId: owner, marker: 'rolled-back' }, { session });
      throw new Error('abort');
    })).rejects.toThrow('abort');
    expect(await connection.collection('nutrition').countDocuments({ userId: owner })).toBe(1);
    expect(await connection.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ writeVersion: 1 });
  });
});
