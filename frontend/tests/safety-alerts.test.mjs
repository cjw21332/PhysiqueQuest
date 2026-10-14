import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('Me omits the removed manual alert test while retaining persisted safety settings and the alert API', async () => {
  const me = await source('sections/Me Section/MeSection.tsx');
  const api = await source('lib/api.ts');
  assert.doesNotMatch(me, /sendSafetyAlert|Test emergency alert|Emergency alert log/);
  assert.match(me, /useSettings/);
  assert.match(me, /toggle\('inactivity'\)/);
  assert.match(api, /\/safety\/alerts/);
});
