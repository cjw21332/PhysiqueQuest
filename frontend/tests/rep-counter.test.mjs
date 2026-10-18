import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { movementFrame } from './fixtures/rep-frames.mjs';

const source = await readFile(new URL('../../shared/repCounter.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { createRepCounter, jointAngle, trackingAngle, trackingExercises, trackingPresets, jointIndices } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
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

test('all twenty-seven selectable exercises have distinct IDs and use the correct movement rule', () => {
  const expected = { 'camera-squat': 'squat', 'camera-curl': 'curl', 'camera-goblet-squat': 'squat', 'camera-sumo-squat': 'squat', 'camera-hammer-curl': 'curl', 'camera-seated-curl': 'curl', 'camera-pushup': 'pushup', 'camera-shoulderpress': 'shoulderpress', 'camera-seated-shoulderpress': 'shoulderpress', 'camera-lateralraise': 'lateralraise', 'camera-band-lateralraise': 'lateralraise', 'camera-knee-pushup': 'kneepushup', 'camera-wall-pushup': 'wallpushup', 'camera-close-grip-pushup': 'pushup' };
  Object.assign(expected, { 'camera-row': 'row', 'camera-single-arm-row': 'row', 'camera-triceps-extension': 'tricepsextension', 'camera-band-curl': 'curl', 'camera-barbell-curl': 'curl', 'camera-kettlebell-goblet-squat': 'squat' });
  Object.assign(expected, { 'camera-hiphinge': 'hiphinge', 'camera-dumbbell-rdl': 'hiphinge', 'camera-barbell-rdl': 'hiphinge', 'camera-bridge': 'bridge', 'camera-dumbbell-bridge': 'bridge', 'camera-lunge': 'lunge', 'camera-dumbbell-lunge': 'lunge' });
  assert.deepEqual(trackingExercises, expected);
  assert.deepEqual(trackingPresets.map(item => item._id).sort(), Object.keys(expected).sort());
  for (const kind of Object.values(expected)) {
    const counter = createRepCounter(kind);
    replay(counter, [180, kind === 'curl' ? 45 : 90, 180], 0, kind === 'pushup' ? pushupFrame : ['squat', 'curl'].includes(kind) ? frame : (angle, time) => movementFrame(kind, angle, time));
    assert.equal(counter.snapshot().reps, 1);
  }
  assert.deepEqual(jointIndices('pushup', 'left'), [11, 13, 15, 23, 27]);
  assert.deepEqual(jointIndices('pushup', 'right'), [12, 14, 16, 24, 28]);
});

for (const kind of ['shoulderpress', 'lateralraise', 'kneepushup', 'wallpushup', 'row', 'tricepsextension', 'hiphinge', 'bridge', 'lunge']) {
  test(`${kind} counts full cycles, rejects partial motion and preserves counts across resets`, () => {
    for (const aspect of [.5, 1, 2]) {
      const counter = createRepCounter(kind);
      const make = (angle, time) => movementFrame(kind, angle, time, aspect);
      let end = replay(counter, [90, 180, 130, 180, 90, 180], 0, make);
      assert.equal(counter.snapshot().reps, 1, `${kind} aspect ${aspect}`);
      end = replay(counter, [90], end, make);
      counter.resetMotion();
      replay(counter, [180], end, make);
      assert.equal(counter.snapshot().reps, 1);
    }
  });
  test(`${kind} discards unfinished reps after joint loss, confidence loss, stale or duplicate frames`, () => {
    for (const fault of ['missing', 'confidence', 'stale', 'duplicate']) {
      const counter = createRepCounter(kind), make = (angle, time) => movementFrame(kind, angle, time);
      const end = replay(counter, [180, 90], 0, make);
      if (fault === 'duplicate') {
        replay(counter, [180], 0, make); assert.equal(counter.snapshot().reps, 0); continue;
      }
      const bad = make(90, end);
      if (fault === 'missing') bad.joints[0] = undefined;
      if (fault === 'confidence') bad.joints.at(-1).visibility = .1;
      if (fault !== 'stale') counter.update(bad);
      replay(counter, [180], end + (fault === 'stale' ? 1000 : 100), make);
      assert.equal(counter.snapshot().reps, 0, `${kind} ${fault}`);
    }
  });
}
test('posture gates separate raises, presses, wall and floor push-ups', () => {
  const arm = movementFrame('shoulderpress', 90);
  arm.joints[2].y = .65; arm.joints[3].y = .55;
  assert.equal(trackingAngle(arm, 'shoulderpress'), null);
  const extension = movementFrame('shoulderpress', 180);
  extension.joints[3] = { ...extension.joints[3], x: extension.joints[2].x + .13, y: extension.joints[2].y };
  assert.equal(trackingAngle(extension, 'shoulderpress'), null); // Overhead triceps bend, with upper arm held up.
  const raise = movementFrame('lateralraise', 90);
  raise.joints[3] = { ...raise.joints[3], x: raise.joints[2].x, y: .27 };
  assert.equal(trackingAngle(raise, 'lateralraise'), null);
  assert.equal(trackingAngle(movementFrame('wallpushup', 90), 'pushup'), null);
  assert.equal(trackingAngle(movementFrame('kneepushup', 90), 'wallpushup'), null);
  assert.deepEqual(jointIndices('kneepushup', 'right'), [12, 14, 16, 24, 26]);
  assert.deepEqual(jointIndices('lateralraise', 'left'), [23, 11, 13, 15]);
});

test('rows reject upright curls and lost knees; triceps extensions reject shoulder presses', () => {
  const upright = movementFrame('row', 90);
  upright.joints[1] = { ...upright.joints[1], x: upright.joints[0].x, y: .1 };
  assert.equal(trackingAngle(upright, 'row'), null);
  const floor = movementFrame('row', 90);
  floor.joints[4].y = floor.joints[0].y;
  assert.equal(trackingAngle(floor, 'row'), null);
  for (const joint of [0, 1, 2, 3, 4]) {
    const hidden = movementFrame('row', 90); hidden.joints[joint].visibility = .1;
    assert.equal(trackingAngle(hidden, 'row'), null);
  }
  assert.equal(trackingAngle(movementFrame('shoulderpress', 90), 'tricepsextension'), null);
  assert.equal(trackingAngle(movementFrame('tricepsextension', 90), 'shoulderpress'), null);
  assert.deepEqual(jointIndices('row', 'right'), [24, 12, 14, 16, 26]);
  assert.deepEqual(jointIndices('tricepsextension', 'left'), [23, 11, 13, 15]);
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
