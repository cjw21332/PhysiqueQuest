import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { titleCase } from './title-case-helper.mjs';

const require = createRequire(import.meta.url);

test('a native alarm reveals stop controls after a late cancellation and stays stopped while location arrives', async () => {
  const slots = [];
  let cursor = 0;
  const effects = [];
  const listeners = new Map();
  let browserStarts = 0;
  const sent = [];
  const resolved = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(fn) { effects.push(fn); },
  };
  const Countdown = () => null;
  const Alarm = () => null;
  const api = {
    getAuthMe: async () => ({ role: 'user' }),
    sendInactivityEvent: async event => { sent.push(event); return { _id: 'alert-1', status: 'failed' }; },
    resolveSafetyAlert: async id => { resolved.push(id); },
  };
  const imports = {
    react,
    'react/jsx-runtime': require('react/jsx-runtime'),
    '../Home/icons': { Icon: () => null },
    './InactivityViews': { InactivityCountdown: Countdown, EmergencyAlarm: Alarm },
    '../../lib/api': { api },
    '../../hooks/useCameraStream': { useCameraStream: () => ({ stop() {}, status: 'idle' }) },
    '../../lib/alarmAudio': { startAlarm: () => { browserStarts++; }, stopAlarm() {} },
    '../../lib/inactivityConstants.mjs': { COUNTDOWN_SECONDS: 30 },
    '../../lib/titleCase': { titleCase },
  };
  const window = {
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener() {},
    setInterval: () => 1, clearInterval() {},
  };
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(new URL('../sections/Coach/LiveSession.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  new Function('require', 'module', 'exports', 'window', outputText)(
    name => { if (!(name in imports)) throw new Error(`Unexpected import: ${name}`); return imports[name]; },
    module, module.exports, window,
  );
  const render = () => {
    cursor = 0;
    return module.exports.default({ exercise: { name: 'Squat' }, workoutId: 'workout-1', thresholdSeconds: 30 });
  };
  render();
  for (const effect of effects.splice(0)) effect();
  const emit = detail => listeners.get('physiquequest-inactivity')({ detail });
  emit({ type: 'countdown-started' });
  const countdown = render();
  assert.equal(countdown.type, Countdown);
  // Simulate an I'm okay tap racing with the host's completed countdown.
  countdown.props.onImOkay();
  emit({ type: 'alarm-started', nativeAudio: true });
  const alarm = render();
  assert.equal(alarm.type, Alarm);
  assert.equal(browserStarts, 0);
  alarm.props.onHoldComplete();
  emit({ type: 'alarm', location: null, nativeAudio: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(render().props.resolved, true);
  assert.deepEqual(resolved, ['alert-1']);
  assert.equal(sent.filter(event => event.eventType === 'inactivity').length, 1);
  assert.equal(browserStarts, 0);
});
