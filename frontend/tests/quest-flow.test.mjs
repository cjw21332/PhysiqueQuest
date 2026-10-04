import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('quest progress is derived from server records and cannot be tapped into completion', async () => {
  const screen = await source('sections/Quests Section/QuestSection.tsx');
  const hook = await source('hooks/useActivity.ts');
  const service = await readFile(new URL('../../backend/src/activity/activity.service.ts', import.meta.url), 'utf8');
  assert.match(screen, /dailyMissions/);
  assert.doesNotMatch(screen, /updateMission|onClick=\{\(\) => update/);
  assert.doesNotMatch(screen, /Missing all daily missions|1 of 3 strikes|30-day streak/);
  assert.match(hook, /timezone/);
  assert.match(service, /dailyMissions/);
  assert.match(service, /questProgress/);
});
