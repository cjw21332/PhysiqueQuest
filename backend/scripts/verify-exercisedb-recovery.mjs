// Isolated checkpoint/retry exercise; uses a dedicated local verification DB.
import { createConnection } from 'mongoose';
import { CatalogSyncService } from '../dist/exercises/catalog-sync.service.js';
import { HttpException } from '@nestjs/common';
import { spawnSync } from 'node:child_process';
const runId = `test-${Date.now()}`;
const uri = `mongodb://127.0.0.1:27017/physiquequest_exercisedb_recovery_${Date.now()}`;
const db = await createConnection(uri).asPromise();
const states = db.collection('exercisedb_sync'), records = db.collection('exercisedb_catalog');
const cursors = [];
const row = id => ({ exerciseId: `${runId}-${id}`, name: `Verification ${id}`, gifUrl: '', bodyParts: [], equipments: [], targetMuscles: [], secondaryMuscles: [], instructions: [] });
let mode = 'first';
const provider = { async providerPage(cursor) { cursors.push(cursor ?? null); if (mode === 'first') return { rows: [row(1), row(2)], meta: { total: 3, hasNextPage: true, nextCursor: 'checkpoint' } }; if (mode === 'fail-rate-limit') throw new HttpException({ retryAfter: '120' }, 429); if (mode.startsWith('fail')) throw new Error(`simulated ${mode}`); return { rows: [row(3)], meta: { total: 3, hasNextPage: false } }; } };
// A named state document is used by the production worker. Refuse to touch an
// existing verification DB; each run must be explicitly isolated.
if (await states.findOne({ _id: 'catalog' })) throw new Error('Verification database already contains state; choose a fresh database.');
const first = new CatalogSyncService(provider); first.db = db;
await first.tick();
const checkpoint = await states.findOne({ _id: 'catalog' });
if (checkpoint?.cursor !== 'checkpoint' || checkpoint.processed !== 2) throw new Error('Checkpoint was not saved');
const second = new CatalogSyncService(provider); second.db = db;
let failure;
for (const [index, kind] of ['rate-limit', 'timeout', 'network'].entries()) {
  await states.updateOne({ _id: 'catalog' }, { $set: { nextAttempt: new Date(0) } }); mode = `fail-${kind}`; await second.tick();
  failure = await states.findOne({ _id: 'catalog' });
  if (failure?.cursor !== 'checkpoint' || failure.failures !== index + 1 || failure.nextAttempt <= new Date()) throw new Error('Failure did not preserve the checkpoint and backoff');
  if (kind === 'rate-limit' && failure.nextAttempt.getTime() - Date.now() < 119000) throw new Error('Retry-After was not honored');
}
await db.close();
const child = spawnSync(process.execPath, ['scripts/exercisedb-recovery-resume-child.mjs', uri, runId], { encoding: 'utf8' });
if (child.status !== 0) throw new Error(`Restarted worker failed: ${child.stderr}`);
const reopened = await createConnection(uri).asPromise();
const status = await reopened.collection('exercisedb_sync').findOne({ _id: 'catalog' });
const count = await reopened.collection('exercisedb_catalog').countDocuments({ exerciseId: { $regex: `^${runId}` } });
if (status?.status !== 'complete' || count !== 3 || cursors.join(',') !== ',checkpoint,checkpoint,checkpoint') throw new Error('Recovery did not complete correctly');
console.log(JSON.stringify({ checkpoint: checkpoint.cursor, initialCount: 2, retryCount: failure.failures, finalCount: count, status: status.status, resumedInNewProcess: true, cursors }));
await reopened.close();
