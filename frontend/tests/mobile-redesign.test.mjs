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
  assert.match(file, /useNotifications/);
  assert.match(file, /markRead/);
});

test('Me keeps persistence and root navigation', async () => {
  const file = await source('sections/Me Section/MeSection.tsx');
  assert.match(file, /useSettings/);
  assert.doesNotMatch(file, /localStorage\.getItem\('physiquequest-me-settings'\)/);
  assert.doesNotMatch(file, /localStorage\.setItem\('physiquequest-me-settings'/);
  assert.match(file, /<BottomNav \/>/);
});

test('launch actions use WebView-safe document navigation', async () => {
  const file = await source('app/launch/page.tsx');
  assert.match(file, /<a className="primary" href="\/register">/);
  assert.match(file, /<a className="secondary" href="\/login">/);
  assert.doesNotMatch(file, /router\.push\('\/(?:register|login)'\)/);
});

test('nutrition and settings screens use server-backed state', async () => {
  const scan = await source('sections/Scan/ScanSection.tsx');
  const me = await source('sections/Me Section/MeSection.tsx');
  assert.match(scan, /useNutrition/);
  assert.doesNotMatch(scan, /useState<FoodEntry\[\]>\(sampleMeals\)/);
  assert.match(me, /useSettings/);
  assert.doesNotMatch(me, /localStorage\.getItem\('physiquequest-me-settings'\)/);
});

test('quests and notifications use server-backed state', async () => {
  const quests = await source('sections/Quests Section/QuestSection.tsx');
  const notifications = await source('sections/Home/Notifications.tsx');
  assert.match(quests, /useActivity/);
  assert.doesNotMatch(quests, /localStorage\.getItem\('physiquequest-quests'\)/);
  assert.match(notifications, /useNotifications/);
  assert.doesNotMatch(notifications, /const initial = \[/);
});
