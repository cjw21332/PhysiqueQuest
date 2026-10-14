import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';

const load = async () => {
  const source = await readFile(new URL('../sections/Scan/nutritionPresentation.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
};
test('preview is allowed only for a successful, genuinely empty nutrition response', async () => {
  const { canPreviewNutrition } = await load();
  assert.equal(canPreviewNutrition(false, '', [], 0), true);
  assert.equal(canPreviewNutrition(true, '', [], 0), false);
  assert.equal(canPreviewNutrition(false, 'Network failed', [], 0), false);
  assert.equal(canPreviewNutrition(false, '', [{ id: 'real' }], 0), false);
  assert.equal(canPreviewNutrition(false, '', [], 2), false);
});
test('reference preview agrees across dashboard, log, history, and food portions', async () => {
  const { createNutritionPreview, summarizeHistory, previewFoods } = await load();
  const today = new Date(2026, 9, 14, 12);
  const { meals, water } = createNutritionPreview(today);
  const current = meals.filter(item => item.date === '2026-10-14');
  assert.equal(current.reduce((s, x) => s + x.calories, 0), 1420);
  assert.equal(current.reduce((s, x) => s + x.protein, 0), 96);
  assert.equal(current.reduce((s, x) => s + x.carbs, 0), 180);
  assert.equal(current.reduce((s, x) => s + x.fat, 0), 42);
  assert.equal(water, 5);
  const summary = summarizeHistory(meals, 7, today);
  assert.equal(summary.average, 1947);
  assert.deepEqual(summary.split, { protein: 28, carbs: 47, fat: 25 });
  assert.equal(previewFoods[0].detail.per_100g.kcal * 1.5, 247.5);
  assert.equal(previewFoods[0].detail.per_100g.protein_g * 1.5, 46.5);
});
test('portion scaling preserves backend scan keys without mutating source values', async () => {
  const { scaleScannedItems, previewScan, summarizeHistory } = await load();
  const scaled = scaleScannedItems(previewScan.items, 1.5);
  assert.equal(scaled.reduce((s, x) => s + x.kcal, 0), 930);
  assert.equal(scaled[0].est_weight_g, 225);
  assert.equal(scaled[0].fdc_id, previewScan.items[0].fdc_id);
  assert.equal(previewScan.items.reduce((s, x) => s + x.kcal, 0), 620);
  assert.deepEqual(summarizeHistory([], 7, new Date(2026, 9, 14)).split, { protein: 0, carbs: 0, fat: 0 });
});

test('review renders only matched scan totals and keeps saving disabled on analysis errors', async () => {
  const helper = await load();
  const require = createRequire(import.meta.url);
  const compile = async (path, imports = require) => {
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', outputText)(imports, module, module.exports);
    return module.exports;
  };
  const icons = await compile('sections/Home/icons.tsx');
  const types = await compile('sections/Scan/types.ts');
  const { default: Review } = await compile('sections/Scan/ReviewEstimate.tsx', name => {
    if (name.endsWith('/api')) return { SCAN_TIMEOUT_MS: 60_000 };
    if (name.endsWith('/icons')) return icons;
    if (name === './types') return types;
    if (name === './nutritionPresentation') return helper;
    return require(name);
  });
  const props = { imageUrl: '', onBack() {}, onRetake() {}, onRetry() {}, onAddManual() {}, onSave() {} };
  const analysis = { ...helper.previewScan, items: [helper.previewScan.items[0], { ...helper.previewScan.items[1], found: false, kcal: 999 }] };
  const ready = renderToStaticMarkup(React.createElement(Review, { ...props, status: 'ready', analysis, error: '' }));
  assert.match(ready, /<b>248<\/b>/);
  assert.match(ready, /cannot be saved/);
  assert.doesNotMatch(ready, /<b>1247<\/b>/);
  const failure = renderToStaticMarkup(React.createElement(Review, { ...props, status: 'error', analysis: null, error: 'Provider unavailable' }));
  assert.match(failure, /Provider unavailable/);
  assert.match(failure, /<button[^>]*disabled=""[^>]*>Save entry<\/button>/);
  assert.doesNotMatch(failure, /Detected items|Estimated macros/);
});
