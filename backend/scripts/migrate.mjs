import assert from 'node:assert/strict';
import { loadEnvFile } from 'node:process';
import mongoose from 'mongoose';
import { up, down, id, indexes } from '../migrations/001-auth-query-indexes.mjs';
const direction = process.argv[2] || 'plan';
assert(['plan', 'up', 'down'].includes(direction), 'Usage: node scripts/migrate.mjs [plan|up|down]');
if (direction === 'plan') {
  assert(new Set(indexes.map(index => `${index.collection}:${index.name}`)).size === indexes.length);
  assert(indexes.every(index => index.name !== '_id_' && Object.keys(index.key).length > 0));
  console.log(JSON.stringify({ id, indexes, rollback: 'Only drops indexes created by this migration; retains collections and records.' }, null, 2));
} else {
  try { loadEnvFile('.env'); } catch { /* Environment may be supplied by hosting. */ }
  assert(process.env.MONGODB_URI, 'MONGODB_URI is required');
  const connection = await mongoose.createConnection(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000, autoIndex: false }).asPromise();
  try { await (direction === 'up' ? up : down)(connection.db); console.log(`${id}: ${direction} complete`); }
  finally { await connection.close(); }
}
