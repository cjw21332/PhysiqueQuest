import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { startIsolatedApp } from './isolated-app.mjs';

const isolated = process.argv.includes('--isolated');
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 10);
const requests = Number(process.env.LOAD_TEST_REQUESTS || 200);
assert(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 100);
assert(Number.isInteger(requests) && requests >= concurrency && requests <= 100_000);
let fixture;
try {
  if (isolated) fixture = await startIsolatedApp();
  const origin = fixture?.url || process.env.LOAD_TEST_URL;
  assert(origin && /^https?:\/\//.test(origin), 'Set LOAD_TEST_URL or use --isolated');
  let token = process.env.LOAD_TEST_TOKEN;
  let legacy;
  if (fixture) {
    const credentials = { name: 'Synthetic load test', email: 'load@example.invalid', password: 'LoadTest123!' };
    const registered = await fetch(`${origin}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
    assert.equal(registered.status, 201); legacy = (await registered.json()).access_token;
    const session = await fetch(`${origin}/api/auth/session/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: credentials.email, password: credentials.password }) });
    assert.equal(session.status, 200); token = (await session.json()).access_token;
  }
  assert(token, 'Set LOAD_TEST_TOKEN for an existing staging account');
  const result = { environment: fixture ? 'isolated development MongoDB, real Nest middleware/services' : 'operator-supplied target', concurrency, requestsPerRoute: requests, measuredAt: new Date().toISOString(), routes: [] };
  for (const [label, path, credential] of [
    ...(legacy ? [['legacy authentication', '/api/auth/me', legacy]] : []),
    ['session authentication', '/api/auth/me', token], ['workout list', '/api/workouts?limit=20', token], ['nutrition read', '/api/nutrition', token],
  ]) {
    const durations = []; let cursor = 0;
    const invoke = async () => {
      const started = performance.now();
      const response = await fetch(`${origin}${path}`, { headers: { Authorization: `Bearer ${credential}` }, signal: AbortSignal.timeout(20_000) });
      await response.arrayBuffer(); assert.equal(response.status, 200, `${label} returned ${response.status}`);
      durations.push(performance.now() - started);
    };
    for (let warmup = 0; warmup < 5; warmup++) await invoke();
    durations.length = 0; const started = performance.now();
    await Promise.all(Array.from({ length: concurrency }, async () => { while (cursor++ < requests) await invoke(); }));
    const elapsed = performance.now() - started; durations.sort((a, b) => a - b);
    const percentile = p => Number(durations[Math.min(durations.length - 1, Math.ceil(durations.length * p) - 1)].toFixed(2));
    result.routes.push({ label, path, p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), requestsPerSecond: Number((requests * 1000 / elapsed).toFixed(2)) });
  }
  console.log(JSON.stringify(result, null, 2));
  if (process.env.LOAD_TEST_REPORT) await writeFile(process.env.LOAD_TEST_REPORT, JSON.stringify(result, null, 2) + '\n');
} finally { await fixture?.close(); }
