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
  assert.match(screen, /Add your first measurement to see your trend/);
  assert.match(screen, /PersonalRecords/);
  assert.doesNotMatch(screen, /samplePersonalRecords|sampleFormScores/);
  assert.match(screen, /useWorkoutHistory/);
  assert.match(await source('hooks/useWorkoutHistory.ts'), /api\.getAllWorkouts/);
  assert.match(hook, /api\.getProgress/);
  assert.match(hook, /await api\.addProgress/);
  assert.match(api, /\/progress/);
});
