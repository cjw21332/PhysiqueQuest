import { MongoClient, ObjectId } from 'mongodb';
import { pathToFileURL } from 'node:url';

// Apply only during a maintenance window in which every application instance,
// worker, registration path and external writer is stopped. A separate check
// of users and insertion of a lifecycle record is not atomic with deletion.
export async function migrateAccountLifecycle(db, { apply = false } = {}) {
  const counts = { examined: 0, eligible: 0, created: 0, skipped: 0, conflicting: 0, failed: 0 };
  const users = db.collection('users'), lifecycle = db.collection('account_lifecycle');
  for await (const user of users.find({}, { projection: { _id: 1, isActive: 1, deletedAt: 1, purgingAt: 1 } })) {
    counts.examined++;
    if (!(user._id instanceof ObjectId) || user.isActive !== true || user.deletedAt !== null || user.purgingAt !== null) { counts.conflicting++; continue; }
    try {
      const existing = await lifecycle.findOne({ _id: user._id }, { projection: { status: 1 } });
      if (existing) { if (existing.status === 'active') counts.skipped++; else counts.conflicting++; continue; }
      counts.eligible++;
      if (!apply) continue;
      try { await lifecycle.insertOne({ _id: user._id, status: 'active', writeVersion: 0, generation: 0, schemaVersion: 1, migratedAt: new Date() }); counts.created++; }
      catch (error) {
        if (error?.code !== 11000) throw error;
        const concurrent = await lifecycle.findOne({ _id: user._id }, { projection: { status: 1 } });
        if (concurrent?.status === 'active') counts.skipped++; else counts.conflicting++;
      }
    } catch { counts.failed++; }
  }
  return counts;
}

export async function auditLegacyWork(db) {
  const result = {};
  for (const name of ['food_scan_usage', 'analysis_jobs', 'storage_uploads', 'push_deliveries', 'password_recovery_tokens', 'email_verifications']) {
    result[name] = { missingGeneration: await db.collection(name).countDocuments({ generation: { $exists: false } }), policy: 'quarantined; never assign current generation; expiry/purge or controlled manual review' };
  }
  return result;
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (apply && !process.argv.includes('--maintenance-confirmed')) throw new Error('Apply requires --maintenance-confirmed after stopping all writers.');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db();
    if (!db.databaseName || db.databaseName === 'test') throw new Error('Set an explicit application database in MONGODB_URI.');
    const counts = await migrateAccountLifecycle(db, { apply });
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...counts, legacy: await auditLegacyWork(db) }));
    if (counts.conflicting || counts.failed) process.exitCode = 1;
  } finally { await client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Lifecycle migration failed. Check the database configuration and maintenance instructions.'); process.exitCode = 1; });
}
