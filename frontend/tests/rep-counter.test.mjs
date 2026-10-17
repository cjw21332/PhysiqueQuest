import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../../shared/repCounter.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { createRepCounter, jointAngle, trackingExercises, trackingPresets, jointIndices } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const frame = (angle, timestamp, aspect = 1) => {
  const radians = angle * Math.PI / 180;
  return { timestamp, aspect, joints: [{ x: 0.5, y: 0.3, visibility: 1 }, { x: 0.5, y: 0.5, visibility: 1 }, { x: 0.5 + 0.2 * Math.sin(radians) / aspect, y: 0.5 - 0.2 * Math.cos(radians), visibility: 1 }] };
};
const pushupFrame = (angle, timestamp) => ({ ...frame(angle, timestamp), joints: [...frame(angle, timestamp).joints, { x: 0.65, y: 0.3, visibility: 1 }, { x: 0.9, y: 0.3, visibility: 1 }] });
function replay(counter, angles, start = 0, makeFrame = frame) {
  let timestamp = start;
  for (const angle of angles) for (let i = 0; i < 6; i++) { counter.update(makeFrame(angle, timestamp)); timestamp += 100; }
  return timestamp;
}

test('squats and curls count only complete straight-bent-straight cycles', () => {
  for (const [kind, bend] of [['squat', 90], ['curl', 45]]) {
    const counter = createRepCounter(kind);
    replay(counter, [bend, 180, bend, 180, 180, bend, 180]);
    assert.equal(counter.snapshot().reps, 2);
  }
});
test('partial motion and boundary jitter never count a rep', () => {
  const counter = createRepCounter('squat');
  replay(counter, [180, 120, 150, 120, 180]);
  assert.equal(counter.snapshot().reps, 0);
  for (let t = 3000; t < 6000; t += 100) counter.update(frame(t % 200 === 0 ? 104 : 112, t));
  replay(counter, [180], 6000);
  assert.equal(counter.snapshot().reps, 0);
});
test('missing, uncertain, offscreen and stale joints discard the unfinished movement', () => {
  for (const invalid of [null, 'uncertain', 'offscreen', 'stale']) {
    const counter = createRepCounter('squat');
    const end = replay(counter, [180, 90]);
    if (invalid !== 'stale') {
      const bad = frame(90, end);
      if (invalid === null) bad.joints = [];
      if (invalid === 'uncertain') bad.joints[1].visibility = 0.1;
      if (invalid === 'offscreen') bad.joints[1].x = 1.1;
      counter.update(bad);
    }
    replay(counter, [180], end + (invalid === 'stale' ? 1000 : 100));
    assert.equal(counter.snapshot().reps, 0);
  }
});
test('pausing and camera changes preserve completed reps but reset motion history', () => {
  const counter = createRepCounter('curl');
  const end = replay(counter, [180, 45, 180, 45]);
  counter.resetMotion();
  replay(counter, [180], end);
  assert.equal(counter.snapshot().reps, 1);
});
test('out-of-order frames cannot advance the counter', () => {
  const counter = createRepCounter('squat');
  replay(counter, [180, 90]);
  for (let i = 0; i < 6; i++) counter.update(frame(180, i * 100));
  assert.equal(counter.snapshot().phase, 'bent');
  assert.equal(counter.snapshot().reps, 0);
});
test('joint geometry respects portrait/landscape aspect and rejects invalid confidence', () => {
  for (const aspect of [0.5, 1, 2]) assert.ok(Math.abs(jointAngle(frame(90, 0, aspect)) - 90) < 0.001);
  const invalid = frame(90, 0); invalid.joints[0].visibility = NaN;
  assert.equal(jointAngle(invalid), null);
  assert.equal(jointAngle({ ...frame(90, 0), aspect: 0 }), null);
  assert.equal(trackingExercises['camera-squat'], 'squat');
  assert.equal(trackingExercises['camera-curl'], 'curl');
});

test('all seven selectable exercises have distinct IDs and use the correct movement rule', () => {
  const expected = { 'camera-squat': 'squat', 'camera-curl': 'curl', 'camera-goblet-squat': 'squat', 'camera-sumo-squat': 'squat', 'camera-hammer-curl': 'curl', 'camera-seated-curl': 'curl', 'camera-pushup': 'pushup' };
  assert.deepEqual(trackingExercises, expected);
  assert.deepEqual(trackingPresets.map(item => item._id).sort(), Object.keys(expected).sort());
  for (const kind of Object.values(expected)) {
    const counter = createRepCounter(kind);
    replay(counter, [180, kind === 'curl' ? 45 : 90, 180], 0, kind === 'pushup' ? pushupFrame : frame);
    assert.equal(counter.snapshot().reps, 1);
  }
  assert.deepEqual(jointIndices('pushup', 'left'), [11, 13, 15, 23, 27]);
  assert.deepEqual(jointIndices('pushup', 'right'), [12, 14, 16, 24, 28]);
});

test('push-ups require a complete top-bottom-top cycle and reject shallow movement', () => {
  const counter = createRepCounter('pushup');
  replay(counter, [90, 180, 120, 180, 90, 180], 0, pushupFrame);
  assert.equal(counter.snapshot().reps, 1);
});

test('push-ups reject upright arm bends, folded bodies and lost or uncertain legs', () => {
  for (const failure of ['upright', 'folded', 'uncertain', 'missing', 'missing-wrist', 'stale']) {
    const counter = createRepCounter('pushup');
    const end = replay(counter, [180, 90], 0, pushupFrame);
    const bad = pushupFrame(90, end);
    if (failure === 'upright') { bad.joints[3] = { x: 0.5, y: 0.5, visibility: 1 }; bad.joints[4] = { x: 0.5, y: 0.8, visibility: 1 }; }
    if (failure === 'folded') bad.joints[3].y = 0.7;
    if (failure === 'uncertain') bad.joints[4].visibility = 0.1;
    if (failure === 'missing') bad.joints.pop();
    if (failure === 'missing-wrist') bad.joints[2] = undefined;
    if (failure !== 'stale') counter.update(bad);
    replay(counter, [180], end + (failure === 'stale' ? 1000 : 100), pushupFrame);
    assert.equal(counter.snapshot().reps, 0, failure);
  }
});
