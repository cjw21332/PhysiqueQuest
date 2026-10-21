import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { createConnection, type Connection } from 'mongoose';
import { up, down } from '../migrations/001-auth-query-indexes.mjs';
try { loadEnvFile('.env'); } catch { /* Runner environment is supported. */ }
describe.skipIf(process.env.PQ_SECURITY_DB_TEST !== '1' || !process.env.MONGODB_URI)('reversible index migration', () => {
  const database = `pq_security_test_${randomBytes(8).toString('hex')}`; let connection: Connection;
  beforeAll(async () => { connection = await createConnection(process.env.MONGODB_URI!, { dbName: database, serverSelectionTimeoutMS: 10_000 }).asPromise(); });
  afterAll(async () => {
    if (!connection) return;
    try { if (!/^pq_security_test_[a-f0-9]{16}$/.test(database) || connection.name !== database) throw Error('Unsafe cleanup'); await connection.dropDatabase(); }
    finally { await connection.close(); }
  });
  it('is repeatable and rolls back only its own indexes without deleting records', async () => {
    const db = connection.db!;
    await db.collection('progress_entries').insertOne({ synthetic: true });
    await db.collection('progress_entries').createIndex({ retained: 1 }, { name: 'retained_1' });
    await up(db); await up(db);
    expect((await db.collection('progress_entries').listIndexes().toArray()).some(index => index.name === 'userId_1_measuredAt_-1')).toBe(true);
    await down(db); await down(db);
    expect(await db.collection('progress_entries').countDocuments()).toBe(1);
    expect((await db.collection('progress_entries').listIndexes().toArray()).map(index => index.name)).toEqual(['_id_', 'retained_1']);
  }, 30_000);
});
