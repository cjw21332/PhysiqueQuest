import assert from 'node:assert/strict';
const base = process.env.READINESS_URL || 'http://127.0.0.1:4000';
assert(/^https?:\/\//.test(base), 'READINESS_URL must be an HTTP(S) origin');
for (const path of ['/health', '/ready', '/api/config']) {
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200, `${path} is not ready`);
  assert(response.headers.get('x-request-id'), `${path} has no request ID`);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  if (base.startsWith('https:')) assert(response.headers.get('strict-transport-security'), 'Missing HSTS');
  const body = await response.json();
  assert(!/password|refresh_token|JWT_SECRET|MONGODB_URI/i.test(JSON.stringify(body)), 'Sensitive readiness payload');
  console.log(`${path}: OK`);
}
