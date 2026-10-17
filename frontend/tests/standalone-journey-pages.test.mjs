import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('goals and progress are standalone authenticated routes with shared app navigation', async () => {
  const goalsRoute = await source('app/(app)/goals/page.tsx');
  const progressRoute = await source('app/(app)/progress/page.tsx');
  const shell = await source('sections/Home/JourneyPageShell.tsx');
  const navigation = await source('sections/Home/BottomNav.tsx');

  assert.match(goalsRoute, /useCurrentProfile/);
  assert.match(goalsRoute, /<GoalsMilestones profile=\{profile\}/);
  assert.match(progressRoute, /useCurrentProfile/);
  assert.match(progressRoute, /<Progress \/>/);
  assert.match(shell, /<BottomNav \/>/);
  assert.match(navigation, /'\/goals', '\/progress'/);
});

test('progress and goals use saved records and honest empty states', async () => {
  const progress = await source('sections/Home/Progress.tsx');
  const goals = await source('sections/Home/GoalsMilestones.tsx');
  const styles = await source('app/globals.css');

  assert.match(progress, /useWorkoutSummary/);
  assert.match(progress, /api\.getWorkouts/);
  assert.match(progress, /addMeasurement/);
  assert.match(goals, /No measurements saved yet/);
  assert.match(goals, /conic-gradient/);
  assert.match(styles, /border-radius: 50%/);
  assert.match(styles, /padding-top: 4px/);
  assert.match(styles, /padding-bottom: 6px/);
});
