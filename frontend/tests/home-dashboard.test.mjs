import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('home cards reflect saved activity and route actions to real screens', async () => {
  const home = await source('sections/Home/HomeDashboard.tsx');
  assert.match(home, /useActivity/);
  assert.match(home, /useNutrition/);
  assert.match(home, /navigate\('\/coach'\)/);
  assert.match(home, /navigate\('\/scan'\)/);
  assert.match(home, /navigate\('\/goals'\)/);
  assert.match(home, /navigate\('\/progress'\)/);
  assert.match(home, /navigate\('\/quests'\)/);
  assert.doesNotMatch(home, /1,840|1\.4k|12\s*<|Week 3|68%/);
});
