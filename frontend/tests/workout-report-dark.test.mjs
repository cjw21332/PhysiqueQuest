import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const module = { exports: {} };
const { outputText } = ts.transpileModule(readFileSync(new URL('../sections/Coach/WorkoutReport.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
new Function('require', 'module', 'exports', outputText)(name => name === '../Home/icons' ? { Icon: () => null } : require(name), module, module.exports);
const Report = module.exports.default;
const workout = { _id: 'saved', exerciseIds: ['bench', 'press'], startedAt: '2026-10-19T08:00:00Z', status: 'completed', durationSeconds: 2536 };

test('reference report preserves saved duration, exercise count, status and confirmed results', () => {
  const html = renderToStaticMarkup(Report({ workout: { ...workout, exerciseResults: [{ exerciseId: 'bench', reps: 37, loadKg: 22 }] } }));
  assert.match(html, /42:16/);
  assert.match(html, /2 exercises/);
  assert.match(html, /Workout completed and saved/);
  assert.match(html, /Confirmed results/);
  assert.match(html, /37 reps/);
  assert.match(html, /22 kg/);
  assert.match(html, /Back to AI Coach/);
});

test('reference report explains missing results without fabricated metrics', () => {
  const html = renderToStaticMarkup(Report({ workout }));
  assert.match(html, /No reps or loads were submitted/);
  assert.doesNotMatch(html, /88%|312 kcal|New personal record|mission done/);
  assert.match(html, /Form analysis, calorie burn, and personal-record tracking are unavailable/);
});

test('report calculates volume from completed sets instead of aggregate peak loads', () => {
  const html = renderToStaticMarkup(Report({ workout: { ...workout,
    sets: [{ exerciseId: 'bench', reps: 10, loadKg: 10, status: 'completed' }, { exerciseId: 'bench', reps: 10, loadKg: 20, status: 'completed' }, { exerciseId: 'press', reps: 100, loadKg: 50, status: 'skipped' }],
    exerciseResults: [{ exerciseId: 'bench', reps: 20, loadKg: 20 }],
  } }));
  assert.match(html, /Volume<b>300 kg/);
  assert.doesNotMatch(html, /400 kg|5,300 kg/);
});

test('report does not invent a volume from aggregate-only records', () => {
  const html = renderToStaticMarkup(Report({ workout: { ...workout, exerciseResults: [{ exerciseId: 'bench', reps: 20, loadKg: 20 }] } }));
  assert.match(html, /Volume<b>—/);
  assert.doesNotMatch(html, /400 kg/);
});
