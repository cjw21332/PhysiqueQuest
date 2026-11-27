import assert from 'node:assert/strict';
import test from 'node:test';
import { EXERCISES, HEALTH_PROGRAMS, templateDays } from '../lib/programCatalog.ts';

// Mirrors backend coach-planner EXCLUSIONS so a health program never prescribes what the planner forbids.
const EXCLUDED: Record<string, string[]> = {
  'Knee injury': ['squat', 'lunge', 'leg press', 'jump'],
  'Lower back pain': ['deadlift', 'good morning', 'bent-over', 'barbell row', 'back extension'],
  'Shoulder impingement': ['overhead', 'shoulder press', 'upright row', 'lateral raise'],
  Hypertension: ['hiit', 'max effort', 'sprint'],
  'Heart condition': ['hiit', 'sprint', 'max effort', 'jump', 'burpee'],
  Asthma: ['hiit', 'sprint', 'max effort'],
};

test('health programs use catalog exercises and avoid movements excluded for their condition', () => {
  assert.ok(HEALTH_PROGRAMS.length >= 5);
  for (const program of HEALTH_PROGRAMS) {
    assert.ok(program.forConditions?.length, `${program.id} names its conditions`);
    for (const day of templateDays(program)) for (const key of day.items) {
      const exercise = EXERCISES[key];
      assert.ok(exercise, `${program.id} uses unknown exercise ${key}`);
      for (const condition of program.forConditions!) for (const term of EXCLUDED[condition]) {
        assert.ok(!exercise.name.toLowerCase().includes(term), `${program.id} includes ${exercise.name}, excluded for ${condition}`);
      }
    }
  }
});
