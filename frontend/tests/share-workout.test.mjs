import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(relative) {
  const output = ts.transpileModule(readFileSync(new URL(relative, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; new Function('exports', output)(module.exports); return module.exports;
}
const { workoutShareText, shareWorkout } = load('../lib/shareWorkout.ts');
test('share summary includes confirmed sets and excludes skipped results and private fields', () => {
  const text = workoutShareText({ durationSeconds: 125, token: 'SECRET', contactPhone: 'PRIVATE', exercises: [{ exerciseId: 'push', name: 'Push-up' }], sets: [{ exerciseId: 'push', status: 'completed', reps: 8 }, { exerciseId: 'push', status: 'skipped', reps: 99 }, { exerciseId: 'push', status: 'completed', reps: 0, durationSeconds: 30, loadKg: 5 }] });
  assert.match(text, /2 min 5 sec/); assert.match(text, /Push-up: 8 reps/); assert.match(text, /30 seconds at 5 kg/);
  assert.doesNotMatch(text, /SECRET|PRIVATE|99|http/);
});
test('native share bridge ignores other requests, handles cancellation and removes its listener', async () => {
  const saved = globalThis.window;
  const target = new EventTarget(); let payload;
  globalThis.window = Object.assign(target, { ReactNativeWebView: { postMessage: value => { payload = JSON.parse(value); } } });
  try {
    const pending = shareWorkout({ sets: [] });
    target.dispatchEvent(new CustomEvent('physiquequest-share-result', { detail: { requestId: 'other', status: 'shared' } }));
    assert.equal(payload.type, 'share-workout');
    target.dispatchEvent(new CustomEvent('physiquequest-share-result', { detail: { requestId: payload.requestId, status: 'cancelled' } }));
    assert.equal(await pending, '');
  } finally { globalThis.window = saved; }
});
test('CSV export neutralizes formula strings while retaining numeric values and quotes', () => {
  const { analyticsCsv } = load('../sections/Me Section/adminPreview.ts');
  assert.equal(analyticsCsv([['=1+1', '@SUM(A1)', 'a"b', -2]]), '"\'=1+1","\'@SUM(A1)","a""b","-2"');
});
