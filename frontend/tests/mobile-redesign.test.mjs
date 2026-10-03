import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('progress keeps local metric selection', async () => {
  const file = await source('sections/Home/Progress.tsx');
  assert.match(file, /useState\('Weight'\)/);
  assert.match(file, /onClick=\{\(\) => setMetric\(option\)\}/);
  assert.match(file, /const data = series\[metric\]/);
});

test('notifications keep readable state updates', async () => {
  const file = await source('sections/Home/Notifications.tsx');
  assert.match(file, /setItems\(current => current\.map/);
  assert.match(file, /onRead=\{\(\) => setItems/);
});

test('Me keeps persistence and root navigation', async () => {
  const file = await source('sections/Me Section/MeSection.tsx');
  assert.match(file, /localStorage\.getItem\('physiquequest-me-settings'\)/);
  assert.match(file, /localStorage\.setItem\('physiquequest-me-settings'/);
  assert.match(file, /<BottomNav \/>/);
});
