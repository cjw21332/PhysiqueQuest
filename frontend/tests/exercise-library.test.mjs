import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';

const path = new URL('../sections/Coach/libraryPreview.ts', import.meta.url);
const loadPreview = async () => {
  const source = await readFile(path, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
};

test('the reference preview contains six dumbbell exercises in the supplied order', async () => {
  const { libraryPreview, filterLibrary } = await loadPreview();
  assert.deepEqual(filterLibrary(libraryPreview, '', 'All', 'Dumbbells').map(item => item.name), [
    'Dumbbell bench press', 'Overhead press', 'Incline press', 'Floor press', 'Bent-over row', 'Goblet squat',
  ]);
  assert.equal(libraryPreview[0].instructions.length, 4);
  assert.deepEqual(libraryPreview[0].checks, ['Wrists stacked over elbows', 'Elbows at roughly 45° from your torso', 'Shoulder blades pinned to the bench']);
  assert.equal(libraryPreview[5].tag, 'Caution');
});

test('search combines with muscle and equipment filters, including a true any-equipment reset', async () => {
  const { libraryPreview, filterLibrary } = await loadPreview();
  assert.equal(filterLibrary(libraryPreview, '  PRESS ', 'Chest', 'Any equipment').length, 3);
  assert.equal(filterLibrary(libraryPreview, '', 'Back', 'Dumbbells')[0].name, 'Bent-over row');
  assert.equal(filterLibrary(libraryPreview, '', 'All', 'Bodyweight').length, 0);
  assert.equal(filterLibrary(libraryPreview, '', 'All', 'Any equipment').length, 6);
  assert.equal(filterLibrary(libraryPreview, 'does not exist', 'All', 'Any equipment').length, 0);
});

test('the exercise library stays reachable during loading, plan errors, and rest days', async () => {
  const require = createRequire(import.meta.url);
  const source = await readFile(new URL('../sections/Coach/CoachPlan.tsx', import.meta.url), 'utf8');
  const icons = await readFile(new URL('../sections/Home/icons.tsx', import.meta.url), 'utf8');
  const compile = (text, imports) => {
    const output = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', output)(imports, module, module.exports);
    return module.exports;
  };
  const actualIcons = compile(icons, require);
  for (const state of [{ loading: true, plan: null, error: '' }, { loading: false, plan: null, error: 'Backend unavailable' }, { loading: false, error: '', plan: { days: [{ index: 0, name: 'Monday', label: 'M', title: 'Rest day', isWorkoutDay: false }] } }]) {
    const { default: CoachPlan } = compile(source, name => {
      if (name.endsWith('useCoachPlan')) return { useCoachPlan: () => ({ ...state, refresh: () => {} }) };
      if (name.endsWith('/icons')) return actualIcons;
      return require(name);
    });
    const html = renderToStaticMarkup(React.createElement(CoachPlan, { profile: {}, onStart: () => {}, onLibrary: () => {} }));
    assert.match(html, /<button[^>]*class="library-link-card"[^>]*>/);
    assert.match(html, /Exercise library/);
    assert.match(html, state.loading ? /Building your plan/ : state.plan ? /Rest day/ : /Backend unavailable/);
  }
});

async function libraryHarness(getExercises) {
  const require = createRequire(import.meta.url);
  const states = []; let cursor = 0; let effects = [];
  const react = { ...React,
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useRef() { return { current: null }; },
    useEffect(effect) { effects.push(effect); },
  };
  const compile = (source, imports) => {
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', output)(imports, module, module.exports);
    return module.exports;
  };
  const icons = compile(await readFile(new URL('../sections/Home/icons.tsx', import.meta.url), 'utf8'), require);
  const component = compile(await readFile(new URL('../sections/Coach/ExerciseLibrary.tsx', import.meta.url), 'utf8'), name => {
    if (name === 'react') return react;
    if (name.endsWith('/api')) return { api: { getExercises } };
    if (name.endsWith('/icons')) return icons;
    return require(name);
  }).default;
  return { render() { cursor = 0; effects = []; const element = component({ onBack() {}, selectedEquipment: [] }); return renderToStaticMarkup(element); }, effects() { return effects; } };
}

test('live library renders fetched records and total pages instead of sample exercises', async () => {
  const requests = [];
  const harness = await libraryHarness(async query => {
    requests.push(query);
    return { items: [{ _id: 'wger-9', name: 'Kettlebell swing', targetMuscle: 'Legs', equipment: 'Kettlebell', pictureUrl: '' }], total: 50, pages: 3 };
  });
  assert.match(harness.render(), /Loading exercises/);
  const cleanup = harness.effects()[0]();
  await new Promise(resolve => setTimeout(resolve, 300));
  const html = harness.render();
  assert.match(html, /Kettlebell swing/);
  assert.match(html, /50 results/);
  assert.match(html, /Page 1 of 3/);
  assert.match(html, /Powered by wger/);
  assert.doesNotMatch(html, /Sample library|Dumbbell bench press/);
  assert.equal(requests[0].equipment, 'Any equipment');
  cleanup();
});

test('upstream failures offer retry and do not masquerade as empty search results', async () => {
  const harness = await libraryHarness(async () => { throw new Error('wger is unavailable'); });
  harness.render(); const cleanup = harness.effects()[0]();
  await new Promise(resolve => setTimeout(resolve, 300));
  const html = harness.render();
  assert.match(html, /role="alert"/);
  assert.match(html, /wger is unavailable/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /No exercises match/);
  cleanup();
});

test('unmounted library ignores late responses', async () => {
  let resolve;
  const harness = await libraryHarness(() => new Promise(done => { resolve = done; }));
  harness.render(); const cleanup = harness.effects()[0]();
  await new Promise(done => setTimeout(done, 300));
  cleanup(); resolve({ items: [{ _id: 'late', name: 'Late exercise' }], total: 1, pages: 1 });
  await new Promise(done => setImmediate(done));
  assert.doesNotMatch(harness.render(), /Late exercise/);
});
