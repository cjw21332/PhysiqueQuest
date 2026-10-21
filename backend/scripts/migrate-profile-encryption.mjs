import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { createConnection } from 'mongoose';
import { HEALTH_FIELDS, transformProfile } from '../dist/privacy/health-encryption.js';
try { loadEnvFile('.env'); } catch { /* Explicit environment is also supported. */ }
const mode = process.argv[2];
if (!['encrypt', 'decrypt'].includes(mode) || !process.env.MONGODB_URI || !process.env.HEALTH_DATA_ENCRYPTION_KEY) {
  throw new Error('Use encrypt|decrypt with MONGODB_URI and HEALTH_DATA_ENCRYPTION_KEY configured');
}
const connection = await createConnection(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 }).asPromise();
try {
  const collection = connection.collection('profiles');
  const projection = Object.fromEntries(['userId', ...HEALTH_FIELDS].map(field => [field, 1]));
  let examined = 0, changed = 0, conflicts = 0;
  for await (const original of collection.find({}, { projection })) {
    examined++;
    const transformed = transformProfile({ ...original }, mode === 'encrypt');
    const set = {}, compare = { _id: original._id, userId: original.userId };
    for (const field of HEALTH_FIELDS) {
      if (original[field] === undefined) continue;
      if (JSON.stringify(original[field]) !== JSON.stringify(transformed[field])) {
        set[field] = transformed[field]; compare[field] = original[field];
      }
    }
    if (!Object.keys(set).length) continue;
    const result = await collection.updateOne(compare, { $set: set });
    if (result.modifiedCount) changed++; else conflicts++;
  }
  console.log(JSON.stringify({ mode, examined, changed, conflicts }));
  if (conflicts) { process.exitCode = 1; console.error('Concurrent changes detected; rerun the migration.'); }
} finally { await connection.close(); }
