import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('API client exposes LAN-safe URL derivation and 401 session clearing', async () => {
  const file = await source('lib/api.ts');
  assert.match(file, /export function getApiBaseUrl\(/);
  assert.match(file, /window\.location\.hostname/);
  assert.match(file, /response\.status\s*===\s*401/);
  assert.match(file, /clearAuthSession\(/);
});

test('auth utilities expose a safe session clear operation', async () => {
  const file = await source('lib/session.ts');
  assert.match(file, /export function clearAuthSession\(\)/);
  assert.match(file, /localStorage\.removeItem\(AUTH_STORAGE_KEY\)/);
});
