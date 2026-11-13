import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { resolveProgressMuscles } from '../lib/progressMuscles.ts';
import { titleCase } from '../lib/titleCase.ts';

test('specific catalog targets take priority over misleading exercise names', () => {
  assert.deepEqual(resolveProgressMuscles('chest supported row', ['lats']).muscles, ['Back']);
  assert.deepEqual(resolveProgressMuscles('squat', ['quadriceps', 'glutes']).muscles, ['Quadriceps', 'Glutes']);
});
test('broad or absent labels use cautious name estimates and preserve unknowns', () => {
  assert.deepEqual(resolveProgressMuscles('biceps curl', ['Arms']), { muscles: ['Biceps'], estimated: true });
  assert.deepEqual(resolveProgressMuscles('goblet squat', ['Legs']).muscles, ['Quadriceps']);
  assert.deepEqual(resolveProgressMuscles('custom movement', ['Legs']).muscles, []);
});
test('names use title case while retaining common acronyms', () => {
  assert.equal(titleCase('DUMBBELL ROW'), 'Dumbbell Row');
  assert.equal(titleCase('ez bar curl'), 'EZ Bar Curl');
  assert.equal(titleCase('range of motion'), 'Range of Motion');
});
