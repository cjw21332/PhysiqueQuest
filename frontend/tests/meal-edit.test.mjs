import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const load = async (file, imports = require) => {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(imports, module, module.exports);
  return module.exports;
};
const components = async (file, react = React) => {
  const icons = await load('sections/Home/icons.tsx');
  const types = await load('sections/Scan/types.ts');
  const calorieProgress = await load('sections/Home/CalorieProgress.tsx');
  const foodNameSearch = await load('sections/Scan/FoodNameSearch.tsx', name => name === '../../lib/api' ? { api: {} } : require(name));
  return load(`sections/Scan/${file}.tsx`, name => name === 'react' ? react : name === '../Home/icons' ? icons : name === './types' ? types : name === '../Home/CalorieProgress' ? calorieProgress : name === './FoodNameSearch' ? foodNameSearch : require(name));
};

test('shared Home calorie progress handles empty, partial, and exceeded targets', async () => {
  const { default: Progress } = await load('sections/Home/CalorieProgress.tsx');
  for (const calories of [0, 1150, 3000]) {
    const tree = Progress({ calories, target: 2300 });
    const svg = tree.props.children[0];
    const circle = svg.props.children[1];
    assert.ok(circle.props.strokeDashoffset >= 0);
    assert.ok(circle.props.strokeDashoffset <= 2 * Math.PI * 45);
    if (calories === 0) assert.equal(circle.props.strokeDashoffset, 2 * Math.PI * 45);
    if (calories === 1150) assert.equal(circle.props.strokeDashoffset, Math.PI * 45);
    if (calories > 2300) assert.equal(circle.props.strokeDashoffset, 0);
    assert.match(renderToStaticMarkup(tree), /home-calorie-progress/);
  }
  for (const file of ['sections/Home/HomeDashboard.tsx', 'sections/Scan/DailyLog.tsx', 'sections/Scan/NutritionDashboard.tsx']) {
    assert.match(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'), /<CalorieProgress/);
  }
});

test('typed food names use debounced backend search and ignore obsolete results', async () => {
  const state = []; let cursor = 0; let effect; let cleanup;
  const react = { ...React, useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; }, useEffect(callback) { effect = callback; } };
  const calls = [];
  const api = { searchFoods(query) { return new Promise(resolve => { calls.push({ query, resolve }); }); } };
  const { default: Search } = await load('sections/Scan/FoodNameSearch.tsx', name => name === 'react' ? react : name === '../../lib/api' ? { api } : require(name));
  let value = 'Rice'; let selected;
  const render = () => { cursor = 0; return Search({ value, disabled: false, onChange(next) { value = next; }, onSelect(food) { selected = food; } }); };
  const find = (node, type) => {
    if (!node || typeof node !== 'object') return undefined;
    if (node.type === type) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, type); if (found) return found; }
  };
  find(render(), 'input').props.onChange({ target: { value: 'Chicken' } });
  render(); cleanup = effect();
  assert.equal(calls.length, 0);
  await new Promise(resolve => setTimeout(resolve, 420));
  assert.equal(calls[0].query, 'Chicken');
  find(render(), 'input').props.onChange({ target: { value: 'Rice' } });
  cleanup(); render(); cleanup = effect();
  await new Promise(resolve => setTimeout(resolve, 420));
  calls[1].resolve({ candidates: [{ fdc_id: 123, description: 'Rice, cooked', data_type: 'Foundation' }] });
  await new Promise(resolve => setImmediate(resolve));
  calls[0].resolve({ candidates: [{ fdc_id: 456, description: 'Old chicken', data_type: 'Foundation' }] });
  await new Promise(resolve => setImmediate(resolve));
  const tree = render();
  assert.match(renderToStaticMarkup(tree), /Rice, cooked/);
  assert.doesNotMatch(renderToStaticMarkup(tree), /Old chicken/);
  find(tree, 'button').props.onClick();
  assert.equal(selected.fdc_id, 123);
  assert.equal(state[0], '');
  cleanup();
});
test('today log displays source, edited flag and original time, with an edit action and empty meal state', async () => {
  const { default: Log } = await components('DailyLog');
  const { sampleMeals } = await load('sections/Scan/types.ts');
  const html = renderToStaticMarkup(React.createElement(Log, { meals: sampleMeals.map(item => ({ ...item, edited: item.meal === 'Lunch' })), water: 5, onBack() {}, onHistory() {}, onAdd() {}, onEdit() {}, onWater() {} }));
  assert.match(html, /Scanned · 07:20/);
  assert.match(html, /Scanned · edited · 12:40/);
  assert.match(html, /Manual · 15:10/);
  assert.match(html, /No logged yet/);
  assert.match(html, /aria-label="Edit Breakfast: Oats and eggs"/);
  assert.doesNotMatch(html, /aria-label="Edit Dinner/);
});
test('meal editor supports individual foods in a multi-item meal and retains the Scan form theme', async () => {
  const { default: Editor } = await components('EditMeal');
  const { sampleMeals } = await load('sections/Scan/types.ts');
  const html = renderToStaticMarkup(React.createElement(Editor, { entries: sampleMeals.slice(0, 2), onBack() {}, async onSave() {} }));
  assert.match(html, /Food to edit/);
  assert.match(html, /Oats and eggs/);
  assert.match(html, /Chicken rice bowl/);
  assert.match(html, /Back to Today&#x27;s Log/);
  assert.match(html, /Save changes/);
  assert.equal((html.match(/type="number"/g) || []).length, 4);
});
test('scan logging sends the device-local logging time rather than leaving it empty', async () => {
  const hook = await readFile(new URL('../hooks/useNutrition.ts', import.meta.url), 'utf8');
  assert.match(hook, /api\.addMealsFromScan\(\{[^}]*time: new Date\(\)\.toLocaleTimeString/);
});

test('editor awaits persistence, preserves entry identity, and shows failed saves for retry', async () => {
  const state = []; let cursor = 0;
  const react = { ...React, useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; } };
  const { default: Editor } = await components('EditMeal', react);
  const { sampleMeals } = await load('sections/Scan/types.ts');
  let rejectSave; let saved;
  const props = { entries: [sampleMeals[0]], onBack() {}, onSave(entry) { saved = entry; return new Promise((_, reject) => { rejectSave = reject; }); } };
  const render = () => { cursor = 0; return Editor(props); };
  const pending = render().props.onSubmit({ preventDefault() {} });
  assert.equal(state[1], true);
  assert.equal(saved.id, sampleMeals[0].id);
  assert.equal(saved.source, 'Scanned');
  assert.equal(saved.time, '07:20');
  rejectSave(new Error('Backend unavailable'));
  await pending;
  assert.equal(state[1], false);
  assert.equal(state[2], 'Backend unavailable');
  assert.match(renderToStaticMarkup(render()), /role="alert">Backend unavailable/);
  props.onSave = async entry => { saved = entry; };
  await render().props.onSubmit({ preventDefault() {} });
  assert.equal(state[2], '');
  assert.equal(state[1], false);
});
