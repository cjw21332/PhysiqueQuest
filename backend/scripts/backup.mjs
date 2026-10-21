import { loadEnvFile } from 'node:process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, stat, unlink, rm } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { backupKey, encryptBackup, decryptBackup } from './backup-crypto.mjs';
try { loadEnvFile('.env'); } catch { /* Environment-only deployment is supported. */ }
const root = resolve(process.env.BACKUP_LOCAL_DIR || '.data/backups');
const bucket = process.env.BACKUP_S3_BUCKET;
const client = bucket ? new S3Client({ region: process.env.S3_REGION || 'auto', endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } : undefined }) : undefined;
const keyPattern = /^backups\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-[a-f0-9]{16}\.dump\.enc$/;
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 35);
if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 35) throw new Error('BACKUP_RETENTION_DAYS must be between 1 and 35');
function tool(command, args) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true });
    child.on('error', () => reject(new Error(`${command} unavailable`)));
    child.on('exit', code => code === 0 ? done() : reject(new Error(`${command} failed; inspect privately with MongoDB tools`)));
  });
}
async function put(key, path) {
  if (client) await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: createReadStream(path), ContentLength: (await stat(path)).size, ContentType: 'application/octet-stream' }));
  else { await mkdir(join(root, 'backups'), { recursive: true }); await pipeline(createReadStream(path), createWriteStream(join(root, key), { flags: 'wx', mode: 0o600 })); }
}
async function get(key, path) {
  if (!keyPattern.test(key)) throw new Error('Invalid backup object key');
  if (client) { const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key })); await pipeline(result.Body, createWriteStream(path, { flags: 'wx', mode: 0o600 })); }
  else await pipeline(createReadStream(join(root, key)), createWriteStream(path, { flags: 'wx', mode: 0o600 }));
}
async function prune() {
  const cutoff = Date.now() - retentionDays * 86400_000; let deleted = 0;
  if (client) {
    let token;
    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'backups/', ContinuationToken: token }));
      for (const object of page.Contents || []) if (keyPattern.test(object.Key || '') && object.LastModified?.getTime() < cutoff) { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key })); deleted++; }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  } else {
    await mkdir(join(root, 'backups'), { recursive: true });
    for (const name of await readdir(join(root, 'backups'))) if (keyPattern.test(`backups/${name}`) && (await stat(join(root, 'backups', name))).mtimeMs < cutoff) { await unlink(join(root, 'backups', name)); deleted++; }
  }
  console.log(JSON.stringify({ event: 'backup_retention', deleted }));
}
async function run(mode, objectKey) {
  if (mode === 'prune') return prune();
  if (!['create', 'restore'].includes(mode)) throw new Error('Use create|restore <object-key>|prune|schedule');
  const key = backupKey(process.env.BACKUP_ENCRYPTION_KEY);
  const temporary = await mkdtemp(join(tmpdir(), 'pq-backup-'));
  try {
    const config = join(temporary, 'mongo.yml'), archive = join(temporary, 'database.dump'), encrypted = join(temporary, 'database.enc');
    if (mode === 'create') {
      if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
      const database = new URL(process.env.MONGODB_URI).pathname.slice(1);
      if (!/^[\w-]+$/.test(database) || ['admin', 'local', 'config'].includes(database)) throw new Error('Backup URI must select one application database');
      await writeFile(config, JSON.stringify({ uri: process.env.MONGODB_URI }), { mode: 0o600 });
      await tool('mongodump', ['--config', config, `--archive=${archive}`, '--gzip']);
      await encryptBackup(archive, encrypted, key);
      const object = `backups/${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-${randomBytes(8).toString('hex')}.dump.enc`;
      await put(object, encrypted); console.log(JSON.stringify({ event: 'backup_created', object, bytes: (await stat(encrypted)).size })); await prune();
    } else {
      const uri = process.env.RESTORE_MONGODB_URI, source = process.env.BACKUP_SOURCE_DATABASE;
      if (!uri || !source || !/^[\w-]+$/.test(source)) throw new Error('RESTORE_MONGODB_URI and BACKUP_SOURCE_DATABASE required');
      const target = new URL(uri).pathname.slice(1);
      if (!/^pq_restore_test_[a-f0-9]{16}$/.test(target)) throw new Error('Restore target must be a new pq_restore_test_<16 hex> database');
      await get(objectKey, encrypted); await decryptBackup(encrypted, archive, key);
      await writeFile(config, JSON.stringify({ uri }), { mode: 0o600 });
      await tool('mongorestore', ['--config', config, `--archive=${archive}`, '--gzip', `--nsInclude=${source}.*`, `--nsFrom=${source}.*`, `--nsTo=${target}.*`, '--stopOnError']);
      console.log(JSON.stringify({ event: 'restore_completed', target, promoteManuallyAfterVerification: true }));
    }
  } finally {
    // mkdtemp created this exact directory; never remove an environment-derived path.
    if (!resolve(temporary).startsWith(resolve(tmpdir()) + '\\') && !resolve(temporary).startsWith(resolve(tmpdir()) + '/')) throw new Error('Unsafe temporary cleanup');
    await rm(temporary, { recursive: true, force: true });
  }
}
if (process.argv[2] === 'schedule') {
  const hours = Number(process.env.BACKUP_INTERVAL_HOURS || 24);
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw new Error('Invalid BACKUP_INTERVAL_HOURS');
  let running = false;
  const tick = async () => { if (running) return; running = true; try { await run('create'); } catch { console.error(JSON.stringify({ event: 'backup_failed' })); } finally { running = false; } };
  await tick(); setInterval(() => { void tick(); }, hours * 3600_000);
} else await run(process.argv[2], process.argv[3]);
