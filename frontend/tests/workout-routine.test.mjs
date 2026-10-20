import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const load = async () => {
  const source = readFileSync(new URL('../sections/Coach/workoutRoutine.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
};
test('routine snapshots retain prescribed sets and timed sets do not fabricate reps', async () => {
  const { routineSnapshot, prescribedWork } = await load();
  assert.deepEqual(routineSnapshot([{ exerciseId: 'squat', name: 'Squat', equipment: 'Bodyweight', prescription: '3 × 12' }]), [{ exerciseId: 'squat', name: 'Squat', equipment: 'Bodyweight', prescription: '3 × 12', sets: 3 }]);
  assert.deepEqual(prescribedWork('3 × 45 s'), { reps: 0, durationSeconds: 45 });
  assert.deepEqual(prescribedWork('4 × 10'), { reps: 10 });
  assert.equal(routineSnapshot([{ exerciseId: 'a', name: 'A', equipment: '', prescription: '99 × 8' }])[0].sets, 10);
});
test('progress distinguishes skipped from done and revisiting uses the same set slot', async () => {
  const { exerciseProgress } = await load();
  const exercise = { exerciseId: 'squat', sets: 2 };
  assert.equal(exerciseProgress(exercise, []), 'upcoming');
  assert.equal(exerciseProgress(exercise, [{ exerciseId: 'squat', setIndex: 0, status: 'completed' }]), 'in progress');
  assert.equal(exerciseProgress(exercise, [{ exerciseId: 'squat', setIndex: 0, status: 'skipped' }, { exerciseId: 'squat', setIndex: 1, status: 'skipped' }]), 'skipped');
  assert.equal(exerciseProgress(exercise, [{ exerciseId: 'squat', setIndex: 0, status: 'completed' }, { exerciseId: 'squat', setIndex: 1, status: 'completed' }]), 'completed');
});
