import { createConnection } from 'mongoose';
import { CatalogSyncService } from '../dist/exercises/catalog-sync.service.js';
const [uri, runId] = process.argv.slice(2);
const db = await createConnection(uri).asPromise();
const states = db.collection('exercisedb_sync');
await states.updateOne({ _id: 'catalog' }, { $set: { nextAttempt: new Date(0) } });
const provider = { async providerPage(cursor) {
  if (cursor !== 'checkpoint') throw new Error('The worker did not resume from its saved cursor');
  return { rows: [{ exerciseId: `${runId}-3`, name: 'Verification 3', gifUrl: '', bodyParts: [], equipments: [], targetMuscles: [], secondaryMuscles: [], instructions: [] }], meta: { total: 3, hasNextPage: false } };
} };
const worker = new CatalogSyncService(provider); worker.db = db; await worker.tick();
const status = await worker.status();
if (status.status !== 'complete' || status.count !== 3) throw new Error('The restarted worker did not finish');
console.log(JSON.stringify({ cursor: 'checkpoint', status: status.status, count: status.count }));
await db.close();
