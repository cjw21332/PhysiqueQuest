import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('meal scanning offers camera capture and photo upload into the same analysis flow', async () => {
  const scan = await source('sections/Scan/ScanSection.tsx');
  const dashboard = await source('sections/Scan/NutritionDashboard.tsx');

  assert.match(dashboard, /onClick=\{onScan\}/);
  const camera = await source('sections/Scan/FoodCamera.tsx');
  assert.match(camera, /getUserMedia/);
  assert.match(camera, /track\.stop\(\)/);
  assert.match(camera, /canvas\.toBlob/);
  assert.match(camera, /Confirm and analyse/);
  assert.match(scan, /aria-label="Upload a meal photo"/);
  assert.match(scan, /setCameraOpen\(true\)/);
  assert.match(scan, /onClick=\{\(\)=>uploadInput\.current\?\.click\(\)\}/);
  assert.match(scan, /onCapture=\{file=>\{setCameraOpen\(false\);setDescription\(''\);setUploadPending\(file\);setDescriptionOpen\(true\);\}\}/);
  assert.match(scan, /setUploadPending\(file\)/);
  assert.match(scan, /setUploadPending\(null\);onPhoto\(file,value\)/);
  assert.match(scan, /<FoodDescriptionDialog/);
  assert.match(scan, /onConfirm=\{\(\)=>setDescriptionOpen\(true\)\}/);
  const confirmation = await source('sections/Scan/PhotoConfirmation.tsx');
  assert.match(confirmation, /Your photo is sent to our AI service to identify the food/);
  assert.match(confirmation, /showModal\(\)/);
  assert.match(confirmation, /onCancel=\{event/);
  assert.match(camera, /Your photo is sent to our AI service to identify the food/);
  assert.match(scan, /api\.analyzeImage\(image, undefined, foodDescription, controller\.signal\)/);
  assert.match(scan, /const retake=.*setPhotoSourceOpen\(true\)/);
});

test('photo inputs stay mounted during nutrition refresh and the review opens immediately', async () => {
  const scan = await source('sections/Scan/ScanSection.tsx');

  assert.doesNotMatch(scan, /if\s*\(loading\)\s*return/);
  assert.match(scan, /<FoodCamera/);
  assert.match(scan, /<input ref=\{uploadInput\}/);
  assert.match(scan, /loading && view === 'nutrition'/);
  assert.match(scan, /\{view==='review'&&<ReviewEstimate/);
});

test('dashboard shows calorie and macro targets with live meals and water controls', async () => {
  const scan = await source('sections/Scan/ScanSection.tsx');
  const dashboard = await source('sections/Scan/NutritionDashboard.tsx');
  const types = await source('sections/Scan/types.ts');

  assert.match(types, /nutritionTargets = \{ calories: 2300, protein: 140, carbs: 240, fats: 70 \}/);
  assert.match(dashboard, /nutritionTargets/);
  assert.match(dashboard, /<CalorieProgress calories=\{calories\} target=\{calorieTarget\}/);
  assert.match(dashboard, /role="progressbar"/);
  assert.match(dashboard, /onClick=\{onHistory\}/);
  assert.match(dashboard, /<MealDiary meals=\{meals\} onAdd=\{onAdd\} onEdit=\{onEdit\}/);
  assert.equal((dashboard.match(/<WaterTracker /g) || []).length, 1);
  assert.match(scan, /onWater=\{setWater\}/);
  assert.doesNotMatch(dashboard, /View log|onLogs/);
  assert.match(await source('app/(app)/scan/[view]/page.tsx'), /view === 'today'\) redirect\('\/scan'\)/);
});
