import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { performanceGuardScript } from './performance-guard.mjs';

test('development guard corrects negative timestamps without changing other measurements', () => {
  const calls = [];
  const performance = { measure(...args) { calls.push(args); return 'result'; } };
  const context = { window: { performance } };
  vm.runInNewContext(performanceGuardScript, context);
  vm.runInNewContext(performanceGuardScript, context);
  const input = { start: -3, end: 5, detail: { value: 1 } };
  assert.equal(performance.measure('HomePage', input), 'result');
  assert.equal(calls[0][1].start, 0);
  assert.equal(calls[0][1].end, 5);
  assert.equal(input.start, -3);
  performance.measure('normal', 'start-mark', 'end-mark');
  assert.deepEqual(calls[1], ['normal', 'start-mark', 'end-mark']);
});
