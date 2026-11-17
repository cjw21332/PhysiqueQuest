import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createConnection, Types, type Connection } from 'mongoose';
import { migrateAccountLifecycle, auditLegacyWork } from '../scripts/audit-account-lifecycle.mjs';
import { assertLifecycleReadiness } from '../src/privacy/lifecycle-readiness.js';

const uri = process.env.PQ_TEST_REPLICA_URI;
const script = fileURLToPath(new URL('../scripts/audit-account-lifecycle.mjs', import.meta.url));
const legacyCollections = ['food_scan_usage', 'analysis_jobs', 'storage_uploads', 'push_deliveries', 'password_recovery_tokens', 'email_verifications'];
// The six legacy-work collections are seeded separately without a generation.
const ownedCollections = ['profiles', 'settings', 'nutrition', 'progress_entries', 'workout_sessions', 'activity', 'notifications', 'safety_alert_events', 'coach_programs', 'push_devices', 'analysis_results', 'sign_in_events', 'auth_sessions', 'future_user_data'];

function isolatedName() { return `pq_lifecycle_staging_${randomBytes(12).toString('hex')}`; }
function resolveUri(name: string) {
  const base = uri!.split('?')[0].replace(/\/$/, '');
  return `${base}/${name}${uri!.includes('?') ? `?${uri!.split('?')[1]}` : ''}`;
}

/** Exercises the operator CLI against synthetic staging data in an isolated database. */
describe.skipIf(!uri)('account lifecycle staging migration', () => {
  const name = isolatedName();
  let connection: Connection;
  const ids: Record<string, Types.ObjectId[]> = { active: [], migrated: [], deleting: [], ambiguous: [], tombstonedUsers: [], tombstonedRows: [] };
  // The CLI deliberately exits non-zero while any conflict remains, so the
  // reported counts, not the exit status alone, must be asserted.
  function run(dbName: string, ...args: string[]) {
    const result = spawnSync(process.execPath, [script, ...args], { cwd: process.cwd(), env: { ...process.env, MONGODB_URI: resolveUri(dbName) }, encoding: 'utf8' });
    if (!result.stdout.trim()) throw new Error(`Migration CLI produced no report: ${result.stderr.trim()}`);
    return { status: result.status, report: JSON.parse(result.stdout.trim()) };
  }
  beforeAll(async () => {
    connection = await createConnection(uri!, { dbName: name, serverSelectionTimeoutMS: 5000 }).asPromise();
    const db = connection.db!;
    const make = (count: number) => Array.from({ length: count }, () => new Types.ObjectId());
    ids.active = make(80); ids.migrated = make(10); ids.deleting = make(5); ids.ambiguous = make(5); ids.tombstonedUsers = make(5); ids.tombstonedRows = make(5);
    await db.collection('users').insertMany([
      ...ids.active.map(_id => ({ _id, email: `active-${_id}@example.test`, isActive: true, deletedAt: null, purgingAt: null })),
      ...ids.migrated.map(_id => ({ _id, email: `migrated-${_id}@example.test`, isActive: true, deletedAt: null, purgingAt: null })),
      ...ids.deleting.map(_id => ({ _id, email: `deleting-${_id}@example.test`, isActive: false, deletedAt: new Date(), purgingAt: null })),
      ...ids.ambiguous.map(_id => ({ _id, email: `ambiguous-${_id}@example.test`, isActive: true })),
      ...ids.tombstonedUsers.map(_id => ({ _id, email: `tombstoned-${_id}@example.test`, isActive: false, deletedAt: new Date('2026-01-01'), purgingAt: null })),
    ]);
    await db.collection('account_lifecycle').insertMany([
      ...ids.migrated.map(_id => ({ _id, status: 'active', generation: 0, writeVersion: 0 })),
      ...ids.deleting.map(_id => ({ _id, status: 'deleting', generation: 1, writeVersion: 1, deletionRequestedAt: new Date() })),
      ...ids.tombstonedUsers.map(_id => ({ _id, status: 'deleted', generation: 2, writeVersion: 3, deletionCompletedAt: new Date('2026-01-01') })),
      ...ids.tombstonedRows.map(_id => ({ _id, status: 'deleted', generation: 2, writeVersion: 3, deletionCompletedAt: new Date('2026-02-01') })),
    ]);
    // Realistic user-owned data must survive migration untouched.
    for (const collection of ownedCollections) {
      await db.collection(collection).insertMany(ids.active.slice(0, 3).map((userId, index) => ({ userId, marker: `${collection}-${index}` })));
    }
    await db.collection('leaderboard_snapshots').insertMany(ids.active.slice(0, 3).map(subjectId => ({ subjectId, period: 'all', boundaryKey: 'all', rank: 1, points: 100 })));
    for (const collection of legacyCollections) await db.collection(collection).insertMany(ids.active.slice(0, 3).map(userId => ({ userId })));
  }, 60000);
  afterAll(async () => {
    if (connection) {
      if (/^pq_lifecycle_staging_[a-f0-9]{24}$/.test(connection.name)) await connection.dropDatabase();
      await connection.close();
    }
  });
  it('runs dry-run, restartable apply and preserves tombstones, owned records and legacy work', async () => {
    const before = Object.fromEntries(await Promise.all(ownedCollections.map(async collection => [collection, await connection.db!.collection(collection).countDocuments()])));
    const dry = run(name);
    expect(dry.report).toMatchObject({ mode: 'dry-run', examined: 105, eligible: 80, created: 0, skipped: 10, conflicting: 15, failed: 0 });
    expect(dry.status).toBe(1);
    expect(await connection.db!.collection('account_lifecycle').countDocuments({ _id: { $in: ids.active } })).toBe(0);
    for (const collection of legacyCollections) expect(dry.report.legacy[collection].missingGeneration).toBe(3);

    const applied = run(name, '--apply', '--maintenance-confirmed');
    expect(applied.report).toMatchObject({ mode: 'apply', examined: 105, eligible: 80, created: 80, skipped: 10, conflicting: 15, failed: 0 });
    expect(applied.status).toBe(1);
    const repeated = run(name, '--apply', '--maintenance-confirmed');
    expect(repeated.report).toMatchObject({ created: 0, skipped: 90, conflicting: 15, failed: 0 });

    expect(await connection.db!.collection('account_lifecycle').countDocuments({ _id: { $in: ids.migrated } })).toBe(10);
    expect(await connection.db!.collection('account_lifecycle').countDocuments({ _id: { $in: ids.active }, status: 'active', schemaVersion: 1 })).toBe(80);
    expect(await connection.db!.collection('account_lifecycle').countDocuments({ _id: { $in: ids.tombstonedRows }, status: 'deleted' })).toBe(5);
    expect(await connection.db!.collection('account_lifecycle').countDocuments({ _id: { $in: ids.tombstonedUsers }, status: 'deleted' })).toBe(5);
    const after = Object.fromEntries(await Promise.all(ownedCollections.map(async collection => [collection, await connection.db!.collection(collection).countDocuments()])));
    expect(after).toEqual(before);
    expect(await connection.db!.collection('profiles').countDocuments({ marker: /^profiles-/ })).toBe(3);
  }, 120000);
  it('startup rejects remaining conflicts and accepts the resolved staging database', async () => {
    await expect(assertLifecycleReadiness(connection)).rejects.toThrow('migration');
    // Operator resolution of the synthetic ambiguous and historical accounts.
    const remove = [...ids.ambiguous, ...ids.tombstonedUsers];
    await connection.db!.collection('users').deleteMany({ _id: { $in: remove } });
    await assertLifecycleReadiness(connection);
  }, 60000);
  it('never assigns a current generation to legacy background work', async () => {
    for (const collection of legacyCollections) {
      expect(await connection.db!.collection(collection).countDocuments({ generation: { $exists: false } })).toBe(3);
    }
    expect(await auditLegacyWork(connection.db!)).toMatchObject({ analysis_jobs: { missingGeneration: 3 }, food_scan_usage: { missingGeneration: 3 } });
  });
  it('resumes after an interrupted run without skipping or duplicating accounts', async () => {
    const dbName = isolatedName(), inner = await createConnection(uri!, { dbName, serverSelectionTimeoutMS: 5000 }).asPromise();
    try {
      const db = inner.db!;
      const users = Array.from({ length: 30 }, () => new Types.ObjectId());
      await db.collection('users').insertMany(users.map(_id => ({ _id, isActive: true, deletedAt: null, purgingAt: null })));
      const realUsers = db.collection('users');
      const interrupting = { collection: (collection: string) => {
        const target = db.collection(collection);
        if (collection !== 'users') return target;
        return { find: (...args: any[]) => {
          const cursor = realUsers.find(...args);
          return { [Symbol.asyncIterator]() {
            const iterator = cursor[Symbol.asyncIterator]();
            let seen = 0;
            return { next: async () => { if (seen++ >= 10) throw new Error('synthetic interruption'); return iterator.next(); } };
          } };
        } };
      } };
      await expect(migrateAccountLifecycle(interrupting as never, { apply: true })).rejects.toThrow('synthetic interruption');
      expect(await db.collection('account_lifecycle').countDocuments({ status: 'active', schemaVersion: 1 })).toBe(10);
      expect(await migrateAccountLifecycle(db, { apply: true })).toMatchObject({ examined: 30, eligible: 20, created: 20, skipped: 10, failed: 0 });
      expect(await db.collection('account_lifecycle').countDocuments({ status: 'active', schemaVersion: 1 })).toBe(30);
      expect(await migrateAccountLifecycle(db, { apply: true })).toMatchObject({ created: 0, skipped: 30, failed: 0 });
    } finally {
      if (/^pq_lifecycle_staging_[a-f0-9]{24}$/.test(inner.name)) await inner.dropDatabase();
      await inner.close();
    }
  }, 60000);
  it('reports a partial failure and lets the next run create only the missing record', async () => {
    const dbName = isolatedName(), inner = await createConnection(uri!, { dbName, serverSelectionTimeoutMS: 5000 }).asPromise();
    try {
      const db = inner.db!;
      const users = Array.from({ length: 40 }, () => new Types.ObjectId());
      const failing = users[17];
      await db.collection('users').insertMany(users.map(_id => ({ _id, isActive: true, deletedAt: null, purgingAt: null })));
      const realLifecycle = db.collection('account_lifecycle');
      const failingDb = { collection: (collection: string) => collection === 'account_lifecycle'
        ? { findOne: realLifecycle.findOne.bind(realLifecycle), insertOne: async (document: { _id: Types.ObjectId }) => {
          if (document._id.equals(failing)) throw new Error('synthetic insert failure');
          return realLifecycle.insertOne(document);
        } }
        : db.collection(collection) };
      const partial = await migrateAccountLifecycle(failingDb as never, { apply: true });
      expect(partial).toMatchObject({ examined: 40, eligible: 40, created: 39, failed: 1 });
      expect(await db.collection('account_lifecycle').countDocuments({ _id: failing })).toBe(0);
      expect(await migrateAccountLifecycle(db, { apply: true })).toMatchObject({ examined: 40, eligible: 1, created: 1, skipped: 39, failed: 0 });
      expect(await db.collection('account_lifecycle').countDocuments({ status: 'active', schemaVersion: 1 })).toBe(40);
    } finally {
      if (/^pq_lifecycle_staging_[a-f0-9]{24}$/.test(inner.name)) await inner.dropDatabase();
      await inner.close();
    }
  }, 60000);
});
