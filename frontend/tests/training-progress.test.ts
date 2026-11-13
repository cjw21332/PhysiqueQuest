import assert from 'node:assert/strict';
import test from 'node:test';
import { exerciseHistory, nextTrainingSuggestion } from '../lib/trainingProgress.ts';
import type { WorkoutSessionRecord } from '../lib/api';

const workout = (reps: number[], options: { status?: 'active' | 'completed'; type?: 'normal' | 'warmup' } = {}): WorkoutSessionRecord => ({
  _id: 'one', exerciseIds: ['bench'], startedAt: '2026-01-01T00:00:00Z', status: options.status ?? 'completed',
  sets: reps.map((value, index) => ({ setId: String(index), exerciseId: 'bench', setIndex: index, reps: value, loadKg: 40, status: 'completed', source: 'manual', setType: options.type ?? 'normal' })),
});
test('recommendations use all completed normal sets and goal range', () => {
  assert.match(nextTrainingSuggestion([workout([10, 10, 10])], 'bench', 'barbell', 'Build muscle', 3), /toward 12 reps/);
  assert.match(nextTrainingSuggestion([workout([12, 12, 12])], 'bench', 'barbell', 'Build muscle', 3), /42.5 kg/);
  assert.match(nextTrainingSuggestion([workout([8, 8, 8])], 'bench', 'barbell', 'Strength', 3), /42.5 kg/);
  assert.match(nextTrainingSuggestion([workout([12, 12, 12])], 'bench', 'barbell', 'Endurance', 3), /toward 15 reps/);
});
test('incomplete, active and warmup sets do not produce a load increase', () => {
  assert.match(nextTrainingSuggestion([workout([12, 12])], 'bench', 'barbell', 'Build muscle', 3), /incomplete/);
  assert.equal(exerciseHistory([workout([12], { status: 'active' }), workout([12], { type: 'warmup' })], 'bench').length, 0);
});
test('weight-loss phase waits for a repeated successful session', () => {
  assert.match(nextTrainingSuggestion([workout([12, 12, 12])], 'bench', 'barbell', 'Build muscle', 3, 'Weight Loss'), /repeat this performance/);
  const previous = { ...workout([12, 12, 12]), startedAt: '2025-12-30T00:00:00Z' };
  assert.match(nextTrainingSuggestion([previous, workout([12, 12, 12])], 'bench', 'barbell', 'Build muscle', 3, 'Weight Loss'), /42.5 kg/);
});
