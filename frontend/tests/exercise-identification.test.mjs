import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { wholeMovementFrame } from './fixtures/rep-frames.mjs';

async function moduleAt(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}
const { createExerciseIdentifier } = await moduleAt('../../shared/repCounter.ts');
const { workoutLabel } = await moduleAt('../lib/workoutLabel.ts');

for (const kind of ['row', 'tricepsextension', 'hiphinge', 'bridge', 'lunge']) for (const side of ['left', 'right']) {
  test(`selected-only ${kind} from ${side} is not automatically mislabeled as an existing movement`, () => {
    const identifier = createExerciseIdentifier(); let time = 0;
    for (const angle of [180, 90, 180, 90, 180]) for (let i = 0; i < 6; i++) {
      identifier.update(wholeMovementFrame(kind, angle, time, side)); time += 100;
    }
    assert.equal(identifier.result(), null);
  });
}

for (const kind of ['shoulderpress', 'lateralraise']) for (const side of ['left', 'right']) {
  test(`identifies ${kind} from ${side} without calling it a curl or squat`, () => {
    const identifier = createExerciseIdentifier(); let time = 0;
    for (const angle of [180, 90, 180, 90, 180]) for (let i = 0; i < 6; i++) {
      identifier.update(wholeMovementFrame(kind, angle, time, side)); time += 100;
    }
    assert.equal(identifier.result()?.kind, kind);
    assert.equal(identifier.result()?.reps, 2);
    assert.equal(identifier.result()?.trackingPresetId, `camera-${kind}`);
    assert.equal(identifier.result()?.equipment, '');
  });
}
test('automatic lateral-raise labels require both shoulders and a front view', () => {
  for (const fault of ['missing', 'side-on']) {
    const identifier = createExerciseIdentifier(); let time = 0;
    for (const angle of [180, 90, 180]) for (let i = 0; i < 6; i++) {
      const frame = wholeMovementFrame('lateralraise', angle, time);
      if (fault === 'missing') frame.joints[12].visibility = .1;
      else frame.joints[12].x = frame.joints[11].x + .01;
      identifier.update(frame); time += 100;
    }
    assert.equal(identifier.result(), null);
  }
});

function frame(kind, angle, timestamp, side = 'left', aspect = 1) {
  const point = (x, y) => ({ x: x / aspect, y, visibility: 1, presence: 1 });
  const joints = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  const [s, e, w, h, k, a] = side === 'left' ? [11, 13, 15, 23, 25, 27] : [12, 14, 16, 24, 26, 28];
  const radians = angle * Math.PI / 180;
  if (kind === 'pushup') {
    joints[s] = point(.2, .35); joints[e] = point(.2, .55);
    joints[w] = point(.2 + .2 * Math.sin(radians), .55 - .2 * Math.cos(radians));
    joints[h] = point(.5, .35); joints[k] = point(.67, .35); joints[a] = point(.85, .35);
  } else if (kind === 'squat') {
    joints[s] = point(.3, .15); joints[e] = point(.3, .3); joints[w] = point(.3, .45);
    joints[h] = point(.3, .45); joints[k] = point(.3, .65);
    joints[a] = point(.3 + .2 * Math.sin(radians), .65 - .2 * Math.cos(radians));
  } else {
    joints[s] = point(.3, .18); joints[e] = point(.3, .36);
    joints[w] = point(.3 + .18 * Math.sin(radians), .36 - .18 * Math.cos(radians));
    joints[h] = point(.3, .55); joints[k] = point(.3, .72); joints[a] = point(.3, .92);
  }
  return { joints, aspect, timestamp };
}
function replay(identifier, kind, angles, start = 0, side = 'left', aspect = 1) {
  let time = start;
  for (const angle of angles) for (let i = 0; i < 6; i++) {
    identifier.update(frame(kind, angle, time, side, aspect)); time += 100;
  }
  return time;
}

for (const kind of ['squat', 'curl', 'pushup']) for (const side of ['left', 'right']) {
  test(`identifies ${kind} from ${side}, counts two full cycles, and does not infer equipment`, () => {
    const identifier = createExerciseIdentifier();
    replay(identifier, kind, [180, kind === 'curl' ? 45 : 90, 180, kind === 'curl' ? 45 : 90, 180], 0, side);
    assert.equal(identifier.result()?.kind, kind);
    assert.equal(identifier.result()?.exerciseId, `movement-${kind}`);
    assert.equal(identifier.result()?.trackingPresetId, kind === 'pushup' ? 'camera-pushup' : `camera-${kind}`);
    assert.equal(identifier.result()?.side, side);
    assert.equal(identifier.result()?.reps, 2);
    assert.equal(identifier.result()?.equipment, kind === 'pushup' ? 'Bodyweight' : '');
  });
}
test('static poses, partial repetitions and empty frames receive no exercise label', () => {
  for (const angles of [[180, 180], [90, 180], [180, 90]]) {
    const identifier = createExerciseIdentifier();
    replay(identifier, 'squat', angles);
    assert.equal(identifier.result(), null);
  }
  const missing = createExerciseIdentifier();
  missing.update({ timestamp: 0, aspect: 1, joints: [] });
  assert.equal(missing.result(), null);
});
test('mixed exercise clips receive no single label', () => {
  const identifier = createExerciseIdentifier();
  const time = replay(identifier, 'squat', [180, 90, 180]);
  replay(identifier, 'pushup', [180, 90, 180], time);
  assert.equal(identifier.result(), null);
});
test('poor coverage and low visibility cannot produce an exercise suggestion', () => {
  const poorCoverage = createExerciseIdentifier();
  const time = replay(poorCoverage, 'squat', [180, 90, 180]);
  for (let i = 0; i < 40; i++) poorCoverage.update({ timestamp: time + i * 100, aspect: 1, joints: [] });
  assert.equal(poorCoverage.result(), null);
  const lowConfidence = createExerciseIdentifier();
  for (let i = 0; i < 30; i++) {
    const value = frame('curl', i < 8 || i > 18 ? 180 : 45, i * 100);
    value.joints.forEach(joint => { joint.visibility = 0.2; });
    lowConfidence.update(value);
  }
  assert.equal(lowConfidence.result(), null);
});
test('aspect ratios and duplicate timestamps cannot change the exercise count', () => {
  const identifier = createExerciseIdentifier();
  const time = replay(identifier, 'curl', [180, 45, 180], 0, 'right', 2);
  replay(identifier, 'curl', [180, 45, 180], 0, 'right', 2);
  assert.equal(identifier.result()?.reps, 1);
  replay(identifier, 'curl', [45, 180], time, 'right', 2);
  assert.equal(identifier.result()?.reps, 2);
});
test('recording labels use reviewed reps and never replace detected counts with the label', () => {
  const recording = { origin: 'recorded-set', exercises: [{ name: 'Push-up' }], sets: [{ status: 'completed', reps: 12, detectedReps: 10 }] };
  assert.equal(workoutLabel(recording), 'Push-up · 12 reps');
  assert.equal(recording.sets[0].detectedReps, 10);
  assert.equal(workoutLabel({ ...recording, sets: [{ status: 'completed', reps: 1 }] }), 'Push-up · 1 rep');
  assert.equal(workoutLabel({ ...recording, origin: 'planned' }), 'Push-up');
  assert.equal(workoutLabel({ origin: 'recorded-set', exerciseResults: [{ reps: 5 }] }), 'Recorded set · 5 reps');
});
