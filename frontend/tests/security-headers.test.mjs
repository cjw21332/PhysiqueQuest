import { test } from 'node:test';
import assert from 'node:assert/strict';
import { securityHeaders } from '../lib/securityHeaders.mjs';
test('production CSP forbids object/frame/eval and preserves local camera workers', () => {
  const headers = securityHeaders(false, { NEXT_PUBLIC_API_URL: 'https://api.example.invalid/api' });
  const csp = headers.find(header => header.key === 'Content-Security-Policy').value;
  assert(csp.includes("frame-ancestors 'none'")); assert(csp.includes("object-src 'none'"));
  assert(!csp.includes("'unsafe-eval'")); assert(csp.includes("worker-src 'self' blob:"));
  assert(csp.includes('https://api.example.invalid')); assert(headers.some(header => header.key === 'Strict-Transport-Security'));
  assert(!securityHeaders(true, {}).some(header => header.key === 'Strict-Transport-Security'));
});
