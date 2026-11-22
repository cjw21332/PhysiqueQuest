import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('workout UI only opens a report after the API confirms completion', async () => {
  const coach = await source('sections/Coach/CoachSection.tsx');
  const session = await source('sections/Coach/LiveSession.tsx');
  const routine = await source('sections/Coach/RoutineSession.tsx');
  const report = await source('sections/Coach/WorkoutReport.tsx');
  // CoachSection owns the active workout itself; the useWorkouts hook is no
  // longer part of that path.
  assert.match(coach, /api\.getActiveWorkout\(\)/);
  assert.match(routine, /await api.completeWorkout/);
  assert.match(coach, /workout={/);
  assert.match(session, /onPause/);
  assert.match(session, /paused/);
  assert.doesNotMatch(session, /setReps/);
  assert.match(report, /No sets logged/);
  assert.doesNotMatch(report, /312 kcal|4\.2k kg|88%/);
});
