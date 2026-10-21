import assert from 'node:assert/strict';
import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createConnection } from 'mongoose';
try { loadEnvFile('.env'); } catch { /* Environment-only runner supported. */ }
assert(process.env.MONGODB_URI, 'MONGODB_URI required');
const suffix = randomBytes(8).toString('hex');
const source = `pq_security_test_${suffix}`, target = `pq_restore_test_${suffix}`;
const uri = name => process.env.MONGODB_URI.replace(/^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/[^?]*)?/, `$1/${name}`);
const directory = await mkdtemp(join(tmpdir(), 'pq-backup-verification-'));
const connections = [];
const env = { ...process.env, MONGODB_URI: uri(source), RESTORE_MONGODB_URI: uri(target), BACKUP_SOURCE_DATABASE: source, BACKUP_ENCRYPTION_KEY: randomBytes(32).toString('base64'), BACKUP_LOCAL_DIR: directory, BACKUP_S3_BUCKET: '' };
async function run(args) {
  await new Promise((done, reject) => {
    const child = spawn(process.execPath, ['scripts/backup.mjs', ...args], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.resume();
    child.on('error', reject);
    child.on('exit', code => code === 0 ? done() : reject(new Error(`Backup validation failed (${code}); no credential output retained`)));
  });
}
try {
  const original = await createConnection(uri(source), { serverSelectionTimeoutMS: 10_000 }).asPromise(); connections.push(original);
  assert.equal(original.name, source);
  await original.collection('synthetic_records').insertOne({ label: 'synthetic-backup', count: 3 });
  await run(['create']);
  const files = await readdir(join(directory, 'backups'));
  assert.equal(files.length, 1); assert(files[0].endsWith('.dump.enc'));
  await run(['restore', `backups/${files[0]}`]);
  const restored = await createConnection(uri(target), { serverSelectionTimeoutMS: 10_000 }).asPromise(); connections.push(restored);
  assert.equal(restored.name, target);
  assert.equal(await restored.collection('synthetic_records').countDocuments({ label: 'synthetic-backup', count: 3 }), 1);
  console.log(JSON.stringify({ backup: 'encrypted local mongodump', restore: 'separate synthetic MongoDB database', checks: 'record count and values match', cloudScheduleVerified: false }));
} finally {
  for (const connection of connections) {
    try { assert([source, target].includes(connection.name)); assert(/^pq_(?:security|restore)_test_[a-f0-9]{16}$/.test(connection.name)); await connection.dropDatabase(); }
    finally { await connection.close(); }
  }
  assert(resolve(directory).startsWith(resolve(tmpdir()) + '/') || resolve(directory).startsWith(resolve(tmpdir()) + '\\'));
  await rm(directory, { recursive: true, force: true });
}
