import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
async function load(path, dependencies) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}
function findButton(node, label) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'button' && node.props.children === label) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = findButton(child, label);
    if (found) return found;
  }
}

test('review makes no pause request and save retries preserve finish time and reviewed reps', async () => {
  const state = [];
  let cursor = 0;
  const react = {
    useCallback: fn => fn,
    useEffect: () => {},
    useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
  };
  const calls = [];
  const api = {
    pauseWorkout: async () => { throw new Error('Review must not pause the server session'); },
    completeWorkout: async (id, data) => {
      calls.push({ id, data });
      if (calls.length === 1) throw new Error('Temporary save failure');
      return { status: 'completed' };
    },
  };
  const { useWorkouts } = await load('hooks/useWorkouts.ts', { react, '../lib/api': { api }, './useApiResource': { notifyDataChanged() {} } });
  const workouts = useWorkouts();
  const { default: TrackingSession } = await load('sections/Coach/TrackingSession.tsx', {
    react,
    '../../hooks/useCameraStream': { useCameraStream: () => ({ status: 'idle', stop() {} }) },
    '../../hooks/useRepTracking': { useRepTracking: () => ({ reps: 12, rate: 0 }) },
    '../../../shared/repCounter': { trackingExercises: { 'camera-squat': 'squat' }, trackingGuidance: {} },
  });
  const render = () => {
    cursor = 0;
    return TrackingSession({
      exercise: { _id: 'camera-squat', name: 'Squat' },
      onPause: paused => workouts.setPaused('workout-id', paused),
      onFinish: (seconds, reps, endedAt) => workouts.completeWorkout('workout-id', seconds, [{ exerciseId: 'camera-squat', reps }], endedAt),
    });
  };
  const before = Date.now();
  findButton(render(), 'Finish and review').props.onClick();
  assert.equal(calls.length, 0);
  await findButton(render(), 'Save workout').props.onClick();
  assert.equal(calls.length, 1);
  assert.ok(Date.parse(calls[0].data.endedAt) >= before);
  await findButton(render(), 'Save workout').props.onClick();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], calls[0]);
  assert.deepEqual(calls[1].data.exerciseResults, [{ exerciseId: 'camera-squat', reps: 12 }]);
});
