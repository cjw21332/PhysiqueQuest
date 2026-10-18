import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalizeRepDb, REPDB_REVISION } from '../lib/repdb-normalize.mjs';

const destination = new URL('../.generated/repdb.ts', import.meta.url);
const transformHash = createHash('sha256').update(await readFile(new URL('../lib/repdb-normalize.mjs', import.meta.url))).digest('hex');
const marker = `// RepDB in-app catalog, pinned revision ${REPDB_REVISION}. Do not republish as a dataset/API.\n// Display transform SHA-256: ${transformHash}\n`;
try {
  const saved = await readFile(destination, 'utf8');
  if (saved.startsWith(marker)) { console.log('RepDB in-app catalog already prepared.'); process.exit(0); }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const response = await fetch(`https://huggingface.co/datasets/RepDB/exercise-dataset/resolve/${REPDB_REVISION}/exercises.json`, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`RepDB preparation failed (${response.status}); no sample catalog was substituted.`);
const body = await response.text();
if (body.length > 5_000_000) throw new Error('RepDB snapshot exceeds the supported size');
const records = normalizeRepDb(JSON.parse(body));
await mkdir(new URL('../.generated/', import.meta.url), { recursive: true });
const temporary = `${fileURLToPath(destination)}.${randomUUID()}.tmp`;
await writeFile(temporary, marker + `// Snapshot SHA-256: ${createHash('sha256').update(body).digest('hex')}\nexport default ${JSON.stringify(records).replace(/</g, '\\u003c')} as import('../lib/api').ExerciseRecord[];\n`, 'utf8');
await rename(temporary, destination);
console.log(`Prepared ${records.length} RepDB guides for in-app use; visible attribution is required.`);
