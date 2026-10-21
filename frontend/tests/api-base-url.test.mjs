import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveApiBaseUrl } from '../lib/apiBaseUrl.mjs';
import { readFile } from 'node:fs/promises';

test('prefers an explicit frontend build API URL over the Expo runtime value', () => {
  assert.equal(
    resolveApiBaseUrl('https://api.example.com/custom/api/', 'http://192.168.1.42:4000/api', {
      protocol: 'http:', hostname: '192.168.1.42',
    }),
    'https://api.example.com/custom/api',
  );
});

test('uses the API address injected by the Expo WebView before host inference', () => {
  assert.equal(
    resolveApiBaseUrl(undefined, 'http://192.168.1.42:4000/api/', {
      protocol: 'http:', hostname: '192.168.1.42',
    }),
    'http://192.168.1.42:4000/api',
  );
});

test('uses the frontend origin proxy by default on LAN and HTTPS', () => {
  assert.equal(resolveApiBaseUrl(undefined, undefined, {
    protocol: 'http:', hostname: '192.168.1.42', port: '3000',
  }), 'http://192.168.1.42:3000/api');
  assert.equal(resolveApiBaseUrl(undefined, undefined, {
    protocol: 'https:', hostname: 'fitness.example.com',
  }), 'https://fitness.example.com/api');
});

test('uses localhost during server rendering only when no explicit API address exists', () => {
  assert.equal(resolveApiBaseUrl(undefined, undefined, undefined), 'http://localhost:4000/api');
  assert.equal(resolveApiBaseUrl('http://api.example.com', undefined, undefined), 'http://api.example.com/api');
});

test('rejects malformed or non-HTTP API origins instead of making a malformed request', () => {
  assert.equal(resolveApiBaseUrl('bad host', undefined, undefined), null);
  assert.equal(resolveApiBaseUrl('file:///tmp/api', undefined, undefined), null);
});

test('does not silently fall back when Expo explicitly injects an invalid or unavailable API address', () => {
  assert.equal(resolveApiBaseUrl(undefined, null, {
    protocol: 'http:', hostname: '192.168.1.42',
  }), null);
  assert.equal(resolveApiBaseUrl(undefined, 'bad host', {
    protocol: 'http:', hostname: '192.168.1.42',
  }), null);
});

test('API client uses the runtime address injected by the mobile WebView', async () => {
  const api = await readFile(new URL('../lib/api.ts', import.meta.url), 'utf8');
  assert.match(api, /resolveApiBaseUrl/);
  assert.match(api, /physiquequest-runtime-api-url/);
});
