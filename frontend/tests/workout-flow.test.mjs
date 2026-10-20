import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('workout UI only opens a report after the API confirms completion', async () => {
  const coach = await source('sections/Coach/CoachSection.tsx');
  const session = await source('sections/Coach/LiveSession.tsx');
  const routine = await source('sections/Coach/RoutineSession.tsx');
  const report = await source('sections/Coach/WorkoutReport.tsx');
  assert.match(coach, /useWorkouts/);
  assert.match(routine, /await api.completeWorkout/);
  assert.match(coach, /workout={/);
  assert.match(session, /onPause/);
  assert.match(session, /paused/);
  assert.doesNotMatch(session, /setReps/);
  assert.match(report, /PROVIDER_NOT_CONFIGURED|unavailable/i);
  assert.doesNotMatch(report, /312 kcal|4\.2k kg|88%/);
});
