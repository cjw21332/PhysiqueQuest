import { MongoClient } from 'mongodb';
import { migrateAccountLifecycle, auditLegacyWork } from './audit-account-lifecycle.mjs';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  // The URI may omit a database name. An explicit override avoids modifying
  // the URI or accidentally auditing the driver's default database.
  const databaseName = process.env.MONGODB_DB?.trim();
  const db = client.db(databaseName || undefined);
  if (!db.databaseName || db.databaseName === 'test') throw new Error('An explicit application database is required');
  const hello = await db.admin().command({ hello: 1 });
  console.log(JSON.stringify({ topology: hello.setName ? 'replica-set' : hello.msg === 'isdbgrid' ? 'sharded' : 'standalone', sessions: Boolean(hello.logicalSessionTimeoutMinutes), counts: await migrateAccountLifecycle(db, { apply: false }), legacy: await auditLegacyWork(db) }));
} catch (error) {
  console.error('Read-only audit failed:', error.name, error.code ?? '', error.message === 'An explicit application database is required' ? error.message : 'Connection or authorization failed');
  process.exitCode = 1;
} finally {
  await client.close();
}
