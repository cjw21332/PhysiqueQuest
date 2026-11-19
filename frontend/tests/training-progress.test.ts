import assert from 'node:assert/strict';
import test from 'node:test';
import { exerciseAnalytics, exerciseHistory, nextTrainingSuggestion, suggestedWorkingSet } from '../lib/trainingProgress.ts';
import type { WorkoutSessionRecord } from '../lib/api';

const workout = (reps: number[], options: { status?: 'active' | 'completed'; type?: 'normal' | 'warmup' } = {}): WorkoutSessionRecord => ({
  _id: 'one', exerciseIds: ['bench'], startedAt: '2026-01-01T00:00:00Z', status: options.status ?? 'completed',
  sets: reps.map((value, index) => ({ setId: String(index), exerciseId: 'bench', setIndex: index, reps: value, loadKg: 40, status: 'completed', source: 'manual', setType: options.type ?? 'normal' })),
});
const at = '2026-01-04T00:00:00Z';
test('recommendations use all completed normal sets and goal range', () => {
  const earlier = { ...workout([12, 12, 12]), startedAt: '2025-12-29T00:00:00Z' };
  assert.match(nextTrainingSuggestion([workout([10, 10, 10])], 'bench', 'barbell', 'Build muscle', 3, undefined, at), /10–12 reps/);
  assert.match(nextTrainingSuggestion([earlier, workout([12, 12, 12])], 'bench', 'barbell', 'Build muscle', 3, undefined, at), /42.5 kg/);
  assert.match(nextTrainingSuggestion([earlier, workout([8, 8, 8])], 'bench', 'barbell', 'Strength', 3, undefined, at), /42.5 kg/);
  assert.match(nextTrainingSuggestion([workout([12, 12, 12])], 'bench', 'barbell', 'Endurance', 3, undefined, at), /12–15 reps/);
});
test('incomplete, active and warmup sets do not produce a load increase', () => {
  assert.match(nextTrainingSuggestion([workout([12, 12])], 'bench', 'barbell', 'Build muscle', 3, undefined, at), /before increasing/);
  assert.equal(exerciseHistory([workout([12], { status: 'active' }), workout([12], { type: 'warmup' })], 'bench').length, 0);
});
test('weight-loss phase waits for a repeated successful session', () => {
  assert.match(nextTrainingSuggestion([workout([12, 12, 12])], 'bench', 'barbell', 'Build muscle', 3, 'Weight Loss', at), /repeat it before considering an increase/);
  const previous = { ...workout([12, 12, 12]), startedAt: '2025-12-30T00:00:00Z' };
  assert.match(nextTrainingSuggestion([previous, workout([12, 12, 12])], 'bench', 'barbell', 'Build muscle', 3, 'Weight Loss', at), /42.5 kg/);
});
test('a single working set gives a load and rep target with timing context', () => {
  const session = workout([8]);
  assert.match(nextTrainingSuggestion([session], 'bench', 'dumbbell', '', 3, undefined, '2026-01-02T00:00:00Z'), /40 kg.*8 reps.*Less than 48 hours/);
  assert.match(nextTrainingSuggestion([session], 'bench', 'dumbbell', '', 3, undefined, at), /Try 40 kg for 8 reps/);
  assert.match(nextTrainingSuggestion([session], 'bench', 'dumbbell', '', 3, undefined, '2026-02-01T00:00:00Z'), /start lighter than 40 kg/);
  assert.match(nextTrainingSuggestion([session], 'bench', 'dumbbell', '', 3, undefined, '2025-12-31T00:00:00Z'), /Log a completed working set/);
});
test('mixed loads and pounds use the last working set, excluding warmups', () => {
  const session = workout([10, 8, 9]);
  session.sets![0] = { ...session.sets![0], setType: 'warmup', loadKg: 10 };
  session.sets![1] = { ...session.sets![1], loadKg: 15 };
  session.sets![2] = { ...session.sets![2], loadKg: 11.3398, loadValue: 25, loadUnit: 'lbs' };
  assert.match(nextTrainingSuggestion([session], 'bench', 'dumbbell', '', 3, undefined, at), /25 lbs × 9 reps.*Try 25 lbs for 9 reps/);
});
test('bar estimates are excluded from the suggested added plates', () => {
  const session = workout([8, 8, 8]);
  session.sets = session.sets!.map(set => ({ ...set, loadKg: 35, loadValue: 35, loadUnit: 'kg', barWeightKg: 10 }));
  assert.match(nextTrainingSuggestion([session], 'bench', 'Smith machine', '', 3, undefined, at), /25 kg added plates × 8 reps/);
});
test('editable defaults use the latest completed working set and reject unknown bar loads', () => {
  const session = workout([12, 9]);
  session.sets![0] = { ...session.sets![0], setType: 'warmup', loadKg: 20 };
  session.sets![1] = { ...session.sets![1], loadKg: 35, loadValue: 35, loadUnit: 'kg', barWeightKg: 10 };
  assert.deepEqual(suggestedWorkingSet([session], 'bench', 'Smith machine', at, true), { reps: 9, weightKg: 25, preferredUnit: 'kg', note: 'Based on your last working sets.', unknownBar: false });
  delete session.sets![1].barWeightKg;
  assert.equal(suggestedWorkingSet([session], 'bench', 'Smith machine', at, true)?.weightKg, undefined);
  assert.equal(suggestedWorkingSet([session], 'bench', 'Smith machine', '2025-12-01T00:00:00Z', true), null);
});
test('each working set follows its own previous load and reps', () => {
  const session = workout([8, 10, 6]);
  session.sets![0] = { ...session.sets![0], loadKg: 15 };
  session.sets![1] = { ...session.sets![1], loadKg: 17.5 };
  session.sets![2] = { ...session.sets![2], loadKg: 20 };
  assert.deepEqual([0, 1, 2, 3].map(index => { const value = suggestedWorkingSet([session], 'bench', 'Dumbbells', at, false, index)!; return [value.weightKg, value.reps]; }), [[15, 8], [17.5, 10], [20, 6], [20, 6]]);
});
test('editable defaults preserve pounds and adjust after a long break', () => {
  const session = workout([10]);
  session.sets![0] = { ...session.sets![0], loadKg: 11.3398, loadValue: 25, loadUnit: 'lbs' };
  const recent = suggestedWorkingSet([session], 'bench', 'Dumbbells', '2026-01-02T00:00:00Z');
  assert.equal(recent?.preferredUnit, 'lbs');
  assert.match(recent!.note, /48 hours/);
  assert.equal(suggestedWorkingSet([session], 'bench', 'Dumbbells', '2026-02-01T00:00:00Z')?.weightKg, 10);
});
test('analytics include bodyweight sets, exclude warmups and order sessions', () => {
  const bodyweight = workout([12, 10]);
  bodyweight.startedAt = '2026-01-03T00:00:00Z';
  bodyweight.sets = bodyweight.sets!.map(({ loadKg: _load, ...set }) => set);
  const rows = exerciseAnalytics([bodyweight, workout([5], { type: 'warmup' }), workout([8])], 'bench');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].volumeKg, 320);
  assert.equal(rows[1].maxLoad, null);
  assert.equal(rows[1].maxReps, 12);
  assert.equal(rows[1].volumeKg, null);
});
