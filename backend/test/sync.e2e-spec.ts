import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { createConnection, Types, type Connection } from 'mongoose';
import { SyncService } from '../src/sync/sync.service.js';
try { loadEnvFile('.env'); } catch { /* Runner env accepted. */ }
describe.skipIf(process.env.PQ_SECURITY_DB_TEST !== '1' || !process.env.MONGODB_URI)('bounded owner sync', () => {
  const database = `pq_security_test_${randomBytes(8).toString('hex')}`; let connection: Connection;
  beforeAll(async () => { connection = await createConnection(process.env.MONGODB_URI!, { dbName: database }).asPromise(); });
  afterAll(async () => { if (!connection) return; try { if (connection.name !== database || !/^pq_security_test_[a-f0-9]{16}$/.test(database)) throw Error('Unsafe database'); await connection.dropDatabase(); } finally { await connection.close(); } });
  it('paginates owned inventory, rejects foreign/tampered cursors and exposes deletes on the next full inventory', async () => {
    const service = new SyncService(connection), owner = new Types.ObjectId(), other = new Types.ObjectId();
    const collection = connection.collection('progress_entries');
    const before = new Date(Date.now() - 60_000).toISOString();
    await collection.insertMany([{ userId: owner, metric: 'weight', value: 70, updatedAt: new Date() }, { userId: owner, metric: 'weight', value: 71, updatedAt: new Date() }, { userId: other, metric: 'weight', value: 99 }]);
    const first = await service.page(String(owner), { resource: 'progress', limit: '1', since: before });
    expect(first.upserts).toHaveLength(1); expect(first.complete).toBe(false);
    await expect(service.page(String(other), { resource: 'progress', limit: '1', since: before, cursor: first.nextCursor! })).rejects.toThrow();
    await expect(service.page(String(owner), { resource: 'progress', cursor: `${first.nextCursor}x` })).rejects.toThrow();
    const second = await service.page(String(owner), { resource: 'progress', limit: '1', since: before, cursor: first.nextCursor! });
    expect(second.complete).toBe(true); expect(second.upserts).toHaveLength(1);
    await collection.deleteOne({ _id: first.upserts[0]._id });
    const next = await service.page(String(owner), { resource: 'progress', since: second.watermark });
    expect(next.inventoryIds).toEqual(second.inventoryIds);
    expect(next.reconciliation).toContain('only on complete');
    const dashboard = await service.dashboard(String(owner));
    expect(dashboard.progress).toHaveLength(1);
    expect(dashboard.progress[0].value).not.toBe(99);
    expect((await service.snapshots(String(owner))).snapshots.profiles).toBeNull();
  });
});
