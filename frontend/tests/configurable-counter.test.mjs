import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { movementFrame } from './fixtures/rep-frames.mjs';
const source = await readFile(new URL('../../shared/repCounter.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { movementDefinitions, trackingKinds, createConfiguredRepCounter, createRepCounter, selectTrackingFrame, jointIndices, worldJointAngle, trackingAngle } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
function replay(counter, poses, start = 0) { let time = start; for (const pose of poses) for (let i = 0; i < 7; i++) { counter.update({ ...pose, timestamp: time }); time += 100; } return time; }
const world = frame => ({ ...frame, worldJoints: frame.joints.map(joint => ({ x: joint.x * frame.aspect, y: joint.y, z: 0 })) });
test('every selectable family has a complete configurable movement definition', () => {
  assert.deepEqual(Object.keys(movementDefinitions).sort(), [...trackingKinds].sort());
  for (const definition of Object.values(movementDefinitions)) assert.ok(createConfiguredRepCounter(definition));
  for (const change of [{ readyAngle: 50, activeAngle: 100 }, { smoothingWeight: NaN }, { maximumGapMs: 10 }, { joints: { left: [1, 1, 2], right: [1, 2, 3] } }, { cues: { start: 'Only one cue' } }]) assert.throws(() => createConfiguredRepCounter({ ...movementDefinitions.squat, ...change }), /Invalid movement definition/);
});
test('custom thresholds and limits change behavior without editing the cycle engine', () => {
  const base = movementDefinitions.squat;
  const configured = createConfiguredRepCounter({ ...base, readyAngle: 170, activeAngle: 75, maximumReps: 1, measure: frame => frame.joints[0].x * 180 });
  const pose = value => ({ joints: [{ x: value / 180 }], aspect: 1 });
  replay(configured, [pose(180), pose(100), pose(180)]); assert.equal(configured.snapshot().reps, 0);
  replay(configured, [pose(180), pose(50), pose(180), pose(50), pose(180)], 3000); assert.equal(configured.snapshot().reps, 1);
});
test('estimated world angles retain depth and reject invisible or invalid image joints', () => {
  const frame = { aspect: 1, timestamp: 0, joints: [{ x: .2, y: .2, visibility: 1 }, { x: .3, y: .4, visibility: 1 }, { x: .4, y: .6, visibility: 1 }], worldJoints: [{ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }] };
  assert.ok(Math.abs(worldJointAngle(frame) - 180) < 1e-6);
  frame.joints[1].visibility = .1; assert.equal(worldJointAngle(frame), null);
  frame.joints[1].visibility = 1; frame.worldJoints[0].z = NaN; assert.equal(worldJointAngle(frame), null);
});
for (const kind of ['hiphinge', 'bridge', 'lunge']) test(`${kind} counts in image/world space and resets unfinished motion on space changes`, () => {
  const ready = movementFrame(kind, 180), active = movementFrame(kind, 90);
  const counter = createRepCounter(kind);
  let time = replay(counter, [world(ready), world(active), world(ready)]);
  assert.equal(counter.snapshot().reps, 1);
  time = replay(counter, [world(active)], time);
  time = replay(counter, [ready], time); assert.equal(counter.snapshot().reps, 1);
  replay(counter, [active, ready], time); assert.equal(counter.snapshot().reps, 2);
  const invalid = world(active); invalid.worldJoints[1].z = NaN;
  assert.equal(trackingAngle(invalid, kind), null);
});
test('transport selects matching image/world indices on both sides without changing the source frame', () => {
  const all = { aspect: 1, timestamp: 12, joints: Array.from({ length: 33 }, (_, index) => ({ x: index / 33, y: .5, visibility: 1 })), worldJoints: Array.from({ length: 33 }, (_, index) => ({ x: index, y: 0, z: -index })) };
  for (const kind of trackingKinds) for (const side of ['left', 'right']) {
    const selected = selectTrackingFrame(all, kind, side);
    assert.deepEqual(selected.worldJoints.map(joint => joint.x), [...jointIndices(kind, side)]);
    assert.equal(selected.joints.length, selected.worldJoints.length);
  }
  assert.equal(all.joints.length, 33); assert.equal(selectTrackingFrame(all, 'auto', 'left'), all);
});
test('new family posture gates reject standing bridges, squat-like hinges and legs together lunges', () => {
  const hinge = movementFrame('hiphinge', 90); hinge.joints[3].x += .15; hinge.joints[3].y = hinge.joints[2].y;
  assert.equal(trackingAngle(hinge, 'hiphinge'), null);
  const bridge = movementFrame('bridge', 90); bridge.joints[0].y = .1;
  assert.equal(trackingAngle(bridge, 'bridge'), null);
  const lunge = movementFrame('lunge', 90); lunge.joints[4].x = lunge.joints[2].x;
  assert.equal(trackingAngle(lunge, 'lunge'), null);
});
