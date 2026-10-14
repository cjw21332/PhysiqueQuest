import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('meal scanning offers camera capture and photo upload into the same analysis flow', async () => {
  const scan = await source('sections/Scan/ScanSection.tsx');
  const dashboard = await source('sections/Scan/NutritionDashboard.tsx');

  assert.match(dashboard, /onClick=\{onScan\}/);
  assert.match(scan, /capture="environment"/);
  assert.match(scan, /aria-label="Take a meal photo"/);
  assert.match(scan, /aria-label="Upload a meal photo"/);
  assert.match(scan, /onClick=\{\(\)=>cameraInput\.current\?\.click\(\)\}/);
  assert.match(scan, /onClick=\{\(\)=>uploadInput\.current\?\.click\(\)\}/);
  assert.equal((scan.match(/onPhoto\(e\.target\.files\?\.\[0\]\)/g) ?? []).length, 2);
  assert.match(scan, /setAnalysis\(await api\.analyzeImage\(image\)\)/);
  assert.match(scan, /const retake=.*setPhotoSourceOpen\(true\)/);
});

test('photo inputs stay mounted during nutrition refresh and the review opens immediately', async () => {
  const scan = await source('sections/Scan/ScanSection.tsx');

  assert.doesNotMatch(scan, /if\s*\(loading\)\s*return/);
  assert.match(scan, /<input ref=\{cameraInput\}/);
  assert.match(scan, /<input ref=\{uploadInput\}/);
  assert.match(scan, /loading && view === 'nutrition'/);
  assert.match(scan, /\{view==='review'&&<ReviewEstimate/);
});

test('today log shows calorie and macro targets with live meals and water controls', async () => {
  const scan = await source('sections/Scan/ScanSection.tsx');
  const log = await source('sections/Scan/DailyLog.tsx');
  const dashboard = await source('sections/Scan/NutritionDashboard.tsx');
  const types = await source('sections/Scan/types.ts');

  assert.match(types, /nutritionTargets = \{ calories: 2300, protein: 140, carbs: 240, fats: 70 \}/);
  assert.match(dashboard, /nutritionTargets/);
  assert.match(log, /nutritionTargets\.calories/);
  assert.match(log, /<CalorieProgress calories=\{calories\} target=\{nutritionTargets.calories\}/);
  assert.match(log, /role="progressbar"/);
  assert.match(log, /onClick=\{onHistory\}/);
  assert.match(log, /onAdd\(meal\)/);
  assert.match(log, /Array\.from\(\{ length: 8 \}/);
  assert.match(scan, /onWater=\{value=>\{void setWater\(value\).*catch/);
  assert.match(scan, /view === 'logs'.*<BottomNav/);
});
