// Rate-limited, resumable metadata audit. It never stores media bodies.
import { createConnection } from 'mongoose';
import { spawn } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
const uri = process.env.EXERCISE_AUDIT_MONGODB_URI;
const output = process.env.EXERCISE_AUDIT_OUTPUT;
const delay = Math.max(1200, Number(process.env.EXERCISE_AUDIT_INTERVAL_MS) || 1200);
if (!uri || !output) throw new Error('Set EXERCISE_AUDIT_MONGODB_URI and EXERCISE_AUDIT_OUTPUT');
const db = await createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
const rows = await db.collection('exercisedb_catalog').find({}, { projection: { exerciseId: 1, gifUrl: 1 } }).sort({ exerciseId: 1 }).toArray();
await db.close();
let prior = '';
try { prior = await readFile(output, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const done = new Set(prior.split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(result => result.invalidUrl || (result.status > 0 && result.status !== 429 && result.status < 500 && !result.error)).map(result => result.id));
function head(url) {
  return new Promise(resolve => {
    const child = spawn('curl', ['-sS', '-I', '-L', '--max-redirs', '5', '--max-time', '20', '-o', process.platform === 'win32' ? 'NUL' : '/dev/null', '-w', '%{http_code}\t%{content_type}\t%{num_redirects}', url]);
    let text = ''; child.stdout.on('data', chunk => { text += chunk; });
    child.on('error', error => resolve({ error: error.message }));
    child.on('close', code => { const [status, contentType, redirects] = text.split('\t'); resolve({ status: Number(status) || 0, contentType: contentType || '', redirects: Number(redirects) || 0, ...(code ? { error: `curl exit ${code}` } : {}) }); });
  });
}
let checked = 0;
for (const row of rows) {
  if (done.has(row.exerciseId)) continue;
  let valid = false;
  try { const url = new URL(row.gifUrl); valid = url.protocol === 'https:' && url.hostname === 'static.exercisedb.dev' && !url.username && !url.password; } catch {}
  const result = valid ? await head(row.gifUrl) : { invalidUrl: true };
  await appendFile(output, JSON.stringify({ id: row.exerciseId, ...result }) + '\n');
  checked++;
  if (checked % 50 === 0) process.stdout.write(`Checked ${checked + done.size}/${rows.length}\n`);
  if (result.status === 429 || result.status === 403) { process.stderr.write(`Provider returned ${result.status}; audit paused.\n`); break; }
  if (valid) await new Promise(resolve => setTimeout(resolve, delay));
}
process.stdout.write(`Audit stopped after ${checked + done.size}/${rows.length} records.\n`);
