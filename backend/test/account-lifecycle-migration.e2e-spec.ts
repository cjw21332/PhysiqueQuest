import { randomBytes } from 'node:crypto';
import { createConnection, Types } from 'mongoose';
import { migrateAccountLifecycle, auditLegacyWork } from '../scripts/audit-account-lifecycle.mjs';

const uri = process.env.PQ_TEST_REPLICA_URI;
describe.skipIf(!uri)('account lifecycle migration audit', () => {
  const name = `pq_lifecycle_migration_${randomBytes(12).toString('hex')}`;
  it('supports dry runs and restartable application without reactivating tombstones', async () => {
    const connection = await createConnection(uri!, { dbName: name, serverSelectionTimeoutMS: 5000 }).asPromise();
    try {
      const db = connection.db!;
      const active = new Types.ObjectId(), deleted = new Types.ObjectId(), ambiguous = new Types.ObjectId();
      await db.collection('users').insertMany([
        { _id: active, isActive: true, deletedAt: null, purgingAt: null },
        { _id: deleted, isActive: true, deletedAt: null, purgingAt: null },
        { _id: ambiguous, isActive: true },
      ]);
      await db.collection('account_lifecycle').insertOne({ _id: deleted, status: 'deleted', writeVersion: 1 });
      expect(await migrateAccountLifecycle(db)).toMatchObject({ examined: 3, eligible: 1, created: 0, conflicting: 2 });
      expect(await db.collection('account_lifecycle').findOne({ _id: active })).toBeNull();
      expect(await migrateAccountLifecycle(db, { apply: true })).toMatchObject({ created: 1, conflicting: 2 });
      expect(await migrateAccountLifecycle(db, { apply: true })).toMatchObject({ created: 0, skipped: 1, conflicting: 2 });
      expect(await db.collection('account_lifecycle').findOne({ _id: deleted })).toMatchObject({ status: 'deleted' });
      await db.collection('analysis_jobs').insertOne({ userId: active, status: 'pending' });
      expect(await auditLegacyWork(db)).toMatchObject({ analysis_jobs: { missingGeneration: 1 } });
      expect(await db.collection('analysis_jobs').findOne({ userId: active })).not.toHaveProperty('generation');
    } finally {
      if (/^pq_lifecycle_migration_[a-f0-9]{24}$/.test(connection.name)) await connection.dropDatabase();
      await connection.close();
    }
  });
});
