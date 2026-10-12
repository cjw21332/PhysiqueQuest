import assert from 'node:assert/strict';
import test from 'node:test';
import { createInactivityMachine } from './inactivityMachine.mjs';
import { createMovementDetector } from './movement.mjs';

const T = 45_000;

test('stillness reaches countdown at exactly the threshold, not before', () => {
  const m = createInactivityMachine({ thresholdMs: T });
  m.start(0);
  m.tick(T - 1);
  assert.equal(m.state, 'MONITORING');
  m.tick(T);
  assert.equal(m.state, 'COUNTDOWN');
  assert.deepEqual(m.drain(), [{ type: 'countdown-started', seconds: 30 }]);
});

test('movement during countdown cancels it and emits cancelled with reason movement', () => {
  const m = createInactivityMachine({ thresholdMs: T });
  m.start(0);
  m.tick(T);
  m.drain();
  m.movement(T + 5_000);
  assert.equal(m.state, 'MONITORING');
  assert.deepEqual(m.drain(), [{ type: 'cancelled', reason: 'movement' }]);
});

test('"I\'m okay" cancels countdown and emits cancelled with reason im-okay', () => {
  const m = createInactivityMachine({ thresholdMs: T });
  m.start(0);
  m.tick(T);
  m.drain();
  m.imOkay(T + 2_000);
  assert.equal(m.state, 'MONITORING');
  assert.deepEqual(m.drain(), [{ type: 'cancelled', reason: 'im-okay' }]);
});

test('countdown reaches alarm at exactly 30 seconds', () => {
  const m = createInactivityMachine({ thresholdMs: T });
  m.start(0);
  m.tick(T);
  m.tick(T + 29_999);
  assert.equal(m.state, 'COUNTDOWN');
  m.tick(T + 30_000);
  assert.equal(m.state, 'ALARM');
  assert.deepEqual(m.drain().at(-1), { type: 'alarm' });
});

test('hold-stop from alarm moves to stopped', () => {
  const m = createInactivityMachine({ thresholdMs: T });
  m.start(0);
  m.tick(T);
  m.tick(T + 30_000);
  m.drain();
  m.holdStop();
  assert.equal(m.state, 'STOPPED');
  assert.deepEqual(m.drain(), [{ type: 'stopped' }]);
});

test('no alarm while monitoring, and movement keeps monitoring alive', () => {
  const m = createInactivityMachine({ thresholdMs: T });
  m.start(0);
  m.movement(30_000);
  m.tick(30_000 + T - 1);
  assert.equal(m.state, 'MONITORING');
  assert.deepEqual(m.drain(), []);
});

// Review Focus 1: a phone set down produces one large spike. It is treated as movement and resets the timer.
test('a single spike after stillness resets the inactivity timer', () => {
  const detector = createMovementDetector();
  const m = createInactivityMachine({ thresholdMs: T });
  m.start(0);
  detector.sample({ x: 0, y: 0, z: 1 });
  if (detector.sample({ x: 0, y: 0, z: 2.5 })) m.movement(30_000);
  m.tick(30_000 + T - 1);
  assert.equal(m.state, 'MONITORING');
  m.tick(30_000 + T);
  assert.equal(m.state, 'COUNTDOWN');
});

// Review Focus 4: the workout ends during countdown. The host stops ticking; no alarm fires.
test('stopping the machine mid-countdown never reaches alarm when ticks stop', () => {
  const m = createInactivityMachine({ thresholdMs: T });
  m.start(0);
  m.tick(T);
  assert.equal(m.state, 'COUNTDOWN');
  m.drain();
  assert.deepEqual(m.drain(), []);
  assert.notEqual(m.state, 'ALARM');
});

test('rejects a non-positive threshold', () => {
  assert.throws(() => createInactivityMachine({ thresholdMs: 0 }));
});

test('movement detector ignores gravity-only readings', () => {
  const d = createMovementDetector();
  assert.equal(d.sample({ x: 0, y: 0, z: 1 }), false);
  assert.equal(d.sample({ x: 0, y: 0, z: 1.02 }), false);
});

test('movement detector flags a change above 0.08 g', () => {
  const d = createMovementDetector();
  d.sample({ x: 0, y: 0, z: 1 });
  assert.equal(d.sample({ x: 0, y: 0, z: 1.2 }), true);
});

test('movement detector reset forgets the previous sample', () => {
  const d = createMovementDetector();
  d.sample({ x: 0, y: 0, z: 1 });
  d.reset();
  assert.equal(d.sample({ x: 0, y: 0, z: 3 }), false);
});
