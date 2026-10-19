import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as machine from './inactivityMachine.mjs';
import * as movement from './movement.mjs';

function monitorHarness() {
  let now = 0;
  const timers = new Map();
  const events = [];
  let starts = 0;
  let stops = 0;
  let finishLocation;
  const imports = {
    'expo-location': {
      requestForegroundPermissionsAsync: () => new Promise(resolve => { finishLocation = () => resolve({ status: 'denied' }); }),
    },
    'expo-sensors': { Accelerometer: { isAvailableAsync: async () => true, setUpdateInterval() {}, addListener: () => ({ remove() {} }) } },
    'expo-keep-awake': { activateKeepAwakeAsync: async () => {}, deactivateKeepAwake() {} },
    './inactivityMachine.mjs': machine,
    './movement.mjs': movement,
    './nativeAlarm': { startNativeAlarm: () => { starts++; return true; }, stopNativeAlarm: () => { stops++; } },
  };
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(new URL('./nativeMonitor.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  new Function('require', 'module', 'exports', 'Date', 'setInterval', 'clearInterval', outputText)(
    name => { if (!(name in imports)) throw new Error(`Unexpected import: ${name}`); return imports[name]; },
    module, module.exports, { now: () => now },
    fn => { const id = Symbol(); timers.set(id, fn); return id; }, id => timers.delete(id),
  );
  const monitor = module.exports.createNativeMonitor({ onEvent: event => events.push(event) });
  return {
    monitor, events,
    tick(time) { now = time; for (const fn of timers.values()) fn(); },
    finishLocation: async () => { finishLocation(); await new Promise(resolve => setImmediate(resolve)); },
    get starts() { return starts; }, get stops() { return stops; }, get timerCount() { return timers.size; },
  };
}

test('native alarm starts immediately without waiting for location permission', async () => {
  const h = monitorHarness();
  await h.monitor.start(30_000);
  h.tick(30_000);
  h.tick(60_000);
  assert.equal(h.starts, 1);
  assert.deepEqual(h.events.at(-1), { type: 'alarm-started', nativeAudio: true });
  await h.finishLocation();
  assert.deepEqual(h.events.at(-1), { type: 'alarm', location: null, nativeAudio: true });
  const before = h.stops;
  h.monitor.holdStop();
  assert.equal(h.stops, before + 1);
});

test('a late I am okay cannot hide an active alarm, and stopping before GPS still records the event', async () => {
  const h = monitorHarness();
  await h.monitor.start(30_000);
  h.tick(30_000);
  h.tick(60_000);
  h.monitor.imOkay();
  assert.equal(h.events.at(-1).type, 'alarm-started');
  h.monitor.holdStop();
  assert.equal(h.events.at(-1).type, 'stopped');
  await h.finishLocation();
  assert.deepEqual(h.events.at(-1), { type: 'alarm', location: null, nativeAudio: true });
});

test('stop silences the alarm and prevents a pending location result from raising it again', async () => {
  const h = monitorHarness();
  await h.monitor.start(30_000);
  h.tick(30_000);
  h.tick(60_000);
  const before = h.stops;
  h.monitor.stop();
  assert.equal(h.stops, before + 1);
  await h.finishLocation();
  assert.equal(h.events.some(event => event.type === 'alarm'), false);
  assert.equal(h.timerCount, 0);
});

test('restarting a monitor replaces its timer instead of leaving two monitors running', async () => {
  const h = monitorHarness();
  await h.monitor.start(30_000);
  await h.monitor.start(60_000);
  assert.equal(h.timerCount, 1);
});
