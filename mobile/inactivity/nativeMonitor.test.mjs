import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function harness(available = async () => true) {
  const timers = new Map(), subscriptions = new Set(), awake = new Set(), events = [];
  let serial = 0, emitted = [];
  const modules = {
    'expo-location': { requestForegroundPermissionsAsync: async () => ({ status: 'denied' }) },
    'expo-sensors': { Accelerometer: { isAvailableAsync: available, setUpdateInterval() {}, addListener(fn) { subscriptions.add(fn); return { remove() { subscriptions.delete(fn); } }; } } },
    'expo-keep-awake': { activateKeepAwakeAsync: async tag => { awake.add(tag); }, deactivateKeepAwake: tag => awake.delete(tag) },
    './inactivityMachine.mjs': { createInactivityMachine: () => ({ start() {}, tick() {}, movement() {}, imOkay() {}, holdStop() {}, drain() { const queue = emitted; emitted = []; return queue; } }) },
    './movement.mjs': { createMovementDetector: () => ({ sample: () => false }) },
  };
  const source = await readFile(new URL('./nativeMonitor.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'setInterval', 'clearInterval', compiled)(name => modules[name], module, module.exports, fn => { const id = ++serial; timers.set(id, fn); return id; }, id => timers.delete(id));
  return { monitor: module.exports.createNativeMonitor({ onEvent: event => events.push(event) }), timers, subscriptions, awake, events, emitAlarm() { emitted = [{ type: 'alarm' }]; [...timers.values()].forEach(fn => fn()); } };
}
test('restarting monitoring retains only one timer and sensor subscription', async () => {
  const f = await harness();
  await f.monitor.start(30_000); await f.monitor.start(45_000);
  assert.equal(f.timers.size, 1); assert.equal(f.subscriptions.size, 1); assert.equal(f.awake.size, 1);
  f.monitor.stop();
  assert.equal(f.timers.size, 0); assert.equal(f.subscriptions.size, 0); assert.equal(f.awake.size, 0);
});
test('background stop during asynchronous startup cannot resurrect the sensor', async () => {
  let resolve;
  const f = await harness(() => new Promise(done => { resolve = done; }));
  const starting = f.monitor.start(30_000);
  await new Promise(done => setImmediate(done));
  f.monitor.stop(); resolve(true); await starting;
  assert.equal(f.timers.size, 0); assert.equal(f.subscriptions.size, 0); assert.equal(f.awake.size, 0);
});
test('stopping monitoring suppresses an alarm awaiting location', async () => {
  const f = await harness(); await f.monitor.start(30_000);
  f.emitAlarm(); f.monitor.stop();
  await new Promise(done => setImmediate(done));
  assert.equal(f.events.some(event => event.type === 'alarm'), false);
});
