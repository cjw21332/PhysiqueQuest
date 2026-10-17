import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
function loader(react = React, api = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} }; cache.set(file, module.exports);
    const imports = name => {
      if (name === 'react') return react;
      if (name.endsWith('/api')) return { api };
      if (name.endsWith('/useSettings')) return { useSettings: () => ({ settings: { inactivity: true, alarmVolume: false, showLeaderboard: true, threshold: 45 }, loading: false, error: '', async updateSettings() {}, async retry() {} }) };
      if (name.endsWith('/BottomNav')) return { default: () => React.createElement('nav', {}, 'Home Coach Scan Quests Me'), __esModule: true };
      if (name.endsWith('/ForgotPasswordFlow') || /\/ExerciseLibrary$|\/AdminExerciseLibrary$|\/EngagementAnalytics$|\/EmergencyAlertLog$/.test(name)) return { default: () => null, __esModule: true };
      if (name.startsWith('.')) {
        const absolute = path.resolve(path.dirname(file), name);
        const candidate = [absolute + '.tsx', absolute + '.ts'].find(existsSync);
        if (candidate) return load(candidate);
      }
      return require(name);
    };
    const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
    new Function('require', 'module', 'exports', outputText)(imports, module, module.exports);
    cache.set(file, module.exports); return module.exports;
  }
  return name => load(path.join(root, 'sections/Me Section', `${name}.tsx`));
}
const profile = { name: 'Alex Sample', email: 'alex@example.test', goal: 'Build muscle', age: '24', height: '179', heightUnit: 'cm', weight: '74', weightUnit: 'kg', targetWeight: '76', targetDate: '2027-03-01', gender: 'Male', activity: 'Moderate', equipment: ['Dumbbells'], days: ['Monday', 'Wednesday', 'Friday', 'Saturday'], duration: '45 min', conditions: ['Knee injury'], contactName: 'Sam Sample', contactPhone: '+639171234567', contactRelationship: 'Parent', createdAt: '2026-08-01' };
const editors = ['PersonalDataEdit', 'GoalsEdit', 'TrainingPreferenceEdit', 'HealthProfileEdit', 'EmergencyContactEdit'];

test('all five reference editors render saved profile values with shared header and footer', () => {
  const load = loader();
  for (const editor of editors) {
    const html = renderToStaticMarkup(React.createElement(load(editor).default, { profile, onBack() {}, async onSave() { return true; } }));
    assert.match(html, /me-reference-edit/);
    assert.match(html, /aria-label="Go back"/);
    assert.match(html, /Save changes/);
    assert.match(html, /disabled=""[^>]*>Save changes/);
    assert.doesNotMatch(html, /<nav/);
  }
  const personal = renderToStaticMarkup(React.createElement(load('PersonalDataEdit').default, { profile, onBack() {}, onSave() {} }));
  assert.match(personal, /value="Alex Sample"/);
  assert.match(personal, /BMI 23.1/);
});

test('every profile editor stays open after a rejected save and returns only after confirmation', async () => {
  for (const editor of editors) {
    const state = []; let cursor = 0; let returned = 0; let confirmed = false; let patch;
    const react = { ...React, useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; }, useMemo(fn) { return fn(); } };
    const Component = loader(react)(editor).default;
    const render = () => { cursor = 0; return Component({ profile, onBack() { returned++; }, async onSave(value) { patch = value; return confirmed; } }); };
    await render().props.onSave();
    assert.equal(returned, 0, editor);
    assert.equal(state[1], false, editor);
    confirmed = true;
    await render().props.onSave();
    assert.equal(returned, 1, editor);
    assert.ok(patch && Object.keys(patch).length > 0);
  }
});

test('account presentation remains dynamic and unit-aware rather than replacing user data with the reference identity', () => {
  const load = loader();
  const html = renderToStaticMarkup(React.createElement(load('MeSection').default, { profile }));
  assert.match(html, /Alex Sample/);
  assert.match(html, /Sam Sample/);
  assert.match(html, /76 kg/);
  assert.match(html, /4 days/);
  assert.match(html, /1 condition logged/);
  assert.doesNotMatch(html, /Toji Dela Cruz/);
  assert.doesNotMatch(html, /View sample profile|Test emergency alert|Emergency alert log/);
  assert.doesNotMatch(html, /Admin tools|Manage exercises|Engagement analytics/);
  assert.match(html, /Exercise library/);
  assert.ok(html.indexOf('Change password') < html.indexOf('Exercise library'));
  assert.ok(html.indexOf('Exercise library') < html.indexOf('Log out'));
  const imperial = { ...profile, height: '5', heightInches: '10', heightUnit: 'ft & in.', weight: '163', weightUnit: 'lb' };
  const personal = renderToStaticMarkup(React.createElement(load('PersonalDataEdit').default, { profile: imperial, onBack() {}, onSave() {} }));
  assert.match(personal, /Height inches/);
  assert.match(personal, /<small>lb<\/small>/);
  assert.match(personal, /BMI 23.4/);
});

test('admin mock catalog and analytics match the supplied reference', async () => {
  const source = readFileSync(path.join(root, 'sections/Me Section/adminPreview.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  const { adminExercisesPreview, filterAdminExercises, analyticsPreview, analyticsCsv } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
  assert.equal(adminExercisesPreview.length, 6);
  assert.equal(filterAdminExercises(adminExercisesPreview, 'published', '').length, 3);
  assert.equal(filterAdminExercises(adminExercisesPreview, 'missing', '').length, 2);
  assert.deepEqual(filterAdminExercises(adminExercisesPreview, 'draft', 'band').map(item => item.name), ['Band pull-apart']);
  const data = analyticsPreview(30);
  assert.equal(data.activeUsers, 1284);
  assert.equal(data.sessionsToday, 312);
  assert.equal(data.formScore, 84);
  assert.equal(data.missionCompletion, 67);
  assert.equal(data.emergencyEvents.total, 14);
  assert.equal(data.cancelled, 9);
  assert.equal(data.emergencyEvents.delivered, 5);
  assert.notEqual(analyticsPreview(7).activeUsers, data.activeUsers);
  assert.notEqual(analyticsPreview(90).activeUsers, data.activeUsers);
  assert.equal(analyticsCsv([['A"B', 14]]), '"A""B","14"');
  const load = loader();
  const catalog = renderToStaticMarkup(React.createElement(load('AdminExerciseLibrary').default, { preview: true, onBack() {} }));
  assert.match(catalog, /Bulgarian split squat/);
  assert.match(catalog, /Kettlebell swing/);
  assert.match(catalog, /Sample data/);
  assert.doesNotMatch(catalog, /Delete|Unpublish/);
  const analytics = renderToStaticMarkup(React.createElement(load('EngagementAnalytics').default, { preview: true, onBack() {} }));
  assert.match(analytics, /1,284/);
  assert.match(analytics, /Cancelled in countdown/);
  assert.match(analytics, /W8/);
});

test('New exercise form validates, saves locally in preview mode and Cancel returns to the list', async () => {
  const state = []; let cursor = 0; let returned = 0;
  const react = { ...React, useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; }, useMemo(fn) { return fn(); }, useCallback(fn) { return fn; }, useEffect() {} };
  const Component = loader(react)('AdminExerciseLibrary').default;
  const render = () => { cursor = 0; return Component({ preview: true, onBack() { returned++; } }); };
  const nodes = (node, predicate) => {
    if (!node || typeof node !== 'object') return [];
    return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => nodes(child, predicate))];
  };
  nodes(render(), node => node.type === 'button' && node.props.className === 'admin-new-button')[0].props.onClick();
  assert.equal(state[3], true);
  let tree = render();
  assert.match(renderToStaticMarkup(tree), /New exercise/);
  assert.doesNotMatch(renderToStaticMarkup(tree), /Search content/);
  let form = nodes(tree, node => node.type === 'form')[0];
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(state[0].length, 6);
  const inputs = nodes(tree, node => node.type === 'input');
  inputs[0].props.onChange({ target: { value: 'Mock row' } });
  inputs[1].props.onChange({ target: { value: 'Dumbbells' } });
  nodes(render(), node => node.type === 'button' && node.props.role === 'switch')[0].props.onClick();
  form = nodes(render(), node => node.type === 'form')[0];
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(state[0].length, 7);
  assert.equal(state[0][6].name, 'Mock row');
  assert.equal(state[0][6].status, 'published');
  assert.equal(state[3], false);
  assert.equal(returned, 0);
  nodes(render(), node => node.type === 'button' && node.props.className === 'admin-new-button')[0].props.onClick();
  nodes(render(), node => node.type === 'button' && node.props.className === 'secondary')[0].props.onClick();
  assert.equal(state[3], false);
  assert.equal(state[0].length, 7);
});

test('explicit admin previews make no API requests, while denied live requests never become mock results', async () => {
  for (const editor of ['AdminExerciseLibrary', 'EngagementAnalytics']) {
    for (const preview of [true, false]) {
      const state = []; let cursor = 0; let effects = []; let calls = 0;
      const react = { ...React, useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; }, useMemo(fn) { return fn(); }, useCallback(fn) { return fn; }, useEffect(fn) { effects.push(fn); } };
      const reject = async () => { calls++; const error = new Error('Not authorized'); error.statusCode = 403; throw error; };
      const Component = loader(react, { getAdminExercises: reject, getAdminAnalytics: reject })(editor).default;
      const render = () => { cursor = 0; effects = []; return Component({ preview, onBack() {} }); };
      render(); for (const effect of effects) effect();
      await new Promise(resolve => setImmediate(resolve));
      const html = renderToStaticMarkup(render());
      assert.equal(calls, preview ? 0 : 1);
      if (!preview) { assert.match(html, /Not authorized/); assert.doesNotMatch(html, /Dumbbell bench press|1,284|sample data/); }
    }
  }
});
