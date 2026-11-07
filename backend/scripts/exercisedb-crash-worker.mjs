import { createConnection } from 'mongoose';
import { CatalogSyncService } from '../dist/exercises/catalog-sync.service.js';
const [uri, mode] = process.argv.slice(2);
const db = await createConnection(uri).asPromise();
const realCollection = db.collection.bind(db);
const records = realCollection('exercisedb_catalog');
await records.createIndex({ exerciseId: 1 }, { unique: true });
const realBulkWrite = records.bulkWrite.bind(records);
let writing = false;
records.bulkWrite = async (operations, options) => {
  if (mode === 'interrupt' && operations.some(op => op.updateOne.filter.exerciseId === 'fixture-5')) {
    await realBulkWrite(operations.slice(0, 1), options);
    writing = true;
    process.stdout.write('WRITE_IN_PROGRESS\n');
    await new Promise(() => {}); // Parent kills this process while the logical bulk write is unfinished.
  }
  return realBulkWrite(operations, options);
};
const row = n => ({ exerciseId: `fixture-${n}`, name: `Verification ${n}`, gifUrl: '', bodyParts: [], equipments: [], targetMuscles: [], secondaryMuscles: [], instructions: [] });
const provider = { async providerPage(cursor) {
  if (!cursor) return { rows: [row(1), row(2)], meta: { total: 6, hasNextPage: true, nextCursor: 'page-2' } };
  if (cursor === 'page-2') return { rows: [row(3), row(4)], meta: { total: 6, hasNextPage: true, nextCursor: 'page-3' } };
  if (cursor === 'page-3') return { rows: [row(5), row(6)], meta: { total: 6, hasNextPage: false } };
  throw new Error('Unexpected cursor');
} };
const worker = new CatalogSyncService(provider); worker.db = db;
const state = realCollection('exercisedb_sync');
if (mode === 'interrupt') {
  for (let i = 0; i < 3; i++) { await state.updateOne({ _id: 'catalog' }, { $set: { nextAttempt: new Date(0) } }); await worker.tick(); }
} else { await worker.tick(); }
if (!writing) { console.log(JSON.stringify(await worker.status())); await db.close(); }
