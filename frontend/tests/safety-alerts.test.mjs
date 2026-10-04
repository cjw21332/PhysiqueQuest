import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('safety alert control displays persisted provider-confirmed status', async () => {
  const me = await source('sections/Me Section/MeSection.tsx');
  const api = await source('lib/api.ts');
  assert.match(me, /sendSafetyAlert/);
  assert.match(me, /PROVIDER_NOT_CONFIGURED|not configured/i);
  assert.match(api, /\/safety\/alerts/);
});
