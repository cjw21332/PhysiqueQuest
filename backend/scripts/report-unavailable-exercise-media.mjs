// Build an investigation report without altering the catalog or re-fetching GIFs.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createConnection } from 'mongoose';
const input = '../output/exercisedb-media-audit.jsonl';
const lines = (await readFile(input, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const failed = new Set(lines.filter(row => row.status === 404).map(row => row.id));
const db = await createConnection('mongodb://127.0.0.1:27017/physiquequest_exercisedb_verify_20261106').asPromise();
const rows = await db.collection('exercisedb_catalog').find({ exerciseId: { $in: [...failed] } }, { projection: { _id: 0, exerciseId: 1, name: 1, gifUrl: 1, bodyParts: 1 } }).sort({ exerciseId: 1 }).toArray();
await db.close();
const auditFinishedAt = (await stat(input)).mtime.toISOString();
const report = { auditFinishedAt, audited404: failed.size, matchedRecords: rows.length, officialAlternateFound: false, permanentStatusKnown: false, recheckedSamples: ['0I5fUyn', '0MlxeMn', '1IFV9h3'], records: rows.map(row => ({ ...row, observedStatus: 404, observedAt: auditFinishedAt })) };
await writeFile('../output/exercisedb-unavailable-media.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ audited404: report.audited404, matchedRecords: report.matchedRecords, officialAlternateFound: false, permanentStatusKnown: false }));
