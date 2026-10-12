import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('progress history comes from API reads and measurements save before appearing', async () => {
  const screen = await source('sections/Home/Progress.tsx');
  const hook = await source('hooks/useProgress.ts');
  const api = await source('lib/api.ts');
  assert.match(screen, /useProgress/);
  assert.match(screen, /addMeasurement/);
  assert.match(screen, /deleteMeasurement/);
  assert.match(screen, /Log your first .* to start a trend/);
  assert.match(screen, /samplePersonalRecords/);
  assert.match(screen, /sampleFormScores/);
  assert.match(screen, /Sample form accuracy trend/);
  assert.match(screen, /showSampleRecords/);
  assert.match(screen, /api\.getWorkouts/);
  assert.match(hook, /api\.getProgress/);
  assert.match(hook, /await api\.addProgress/);
  assert.match(api, /\/progress/);
});
