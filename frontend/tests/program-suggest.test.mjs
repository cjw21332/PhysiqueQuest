import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const load = async file => {
  const source = readFileSync(new URL(`../lib/${file}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
};

test('a new lifter gets conservative, sex- and goal-aware loads with no history', async () => {
  const { trainingContext, suggestFor } = await load('programSuggest.ts');
  const man = trainingContext({ weight: '80', weightUnit: 'kg', height: '178', heightUnit: 'cm', age: '25', gender: 'Male', goal: 'Build muscle', activity: 'Moderate' });
  const woman = trainingContext({ weight: '60', weightUnit: 'kg', height: '165', heightUnit: 'cm', age: '25', gender: 'Female', goal: 'Build muscle', activity: 'Moderate' });
  const bench = suggestFor({ name: 'Barbell Bench Press', equipment: 'Barbell', kind: 'main' }, man);
  assert.equal(bench.basis, 'profile');
  assert.ok(bench.weight >= 30 && bench.weight <= 50, `bench ${bench.weight}`);
  assert.equal(bench.restSets, 180);
  assert.equal(suggestFor({ name: 'Barbell Bench Press', equipment: 'Barbell', kind: 'main' }, woman).weight, 20, 'never below an empty bar');
  const curl = suggestFor({ name: 'Dumbbell Curl', equipment: 'Dumbbells' }, man);
  assert.ok(curl.perHand && curl.weight >= 4 && curl.weight <= 12, `curl ${curl.weight}`);
  assert.equal(curl.restSets, 75);
  assert.equal(suggestFor({ name: 'Pull-Up', equipment: 'Bodyweight' }, man).weight, undefined);
});

test('logged bests, strength goals, older lifters and pound users adjust the plan', async () => {
  const { trainingContext, suggestFor, prescriptionText, sessionMinutes } = await load('programSuggest.ts');
  const withHistory = trainingContext({ weight: '80', gender: 'Male', goal: 'Build muscle', activity: 'Light' }, [{ exerciseId: 'x', name: 'Barbell Bench Press', loadKg: 100 }]);
  const fromHistory = suggestFor({ name: 'barbell bench press', equipment: 'Barbell' }, withHistory);
  assert.equal(fromHistory.basis, 'history');
  assert.ok(fromHistory.weight > 70, `history ${fromHistory.weight}`);
  const strength = suggestFor({ name: 'Back Squat', equipment: 'Barbell' }, trainingContext({ weight: '80', goal: 'Strength', activity: 'Active' }));
  assert.equal(strength.sets, 4);
  assert.equal(strength.reps, '4-6');
  assert.equal(strength.restSets, 240);
  const senior = suggestFor({ name: 'Back Squat', equipment: 'Barbell' }, trainingContext({ weight: '80', age: '67', goal: 'Strength', activity: 'Active' }));
  assert.equal(senior.reps, '6-8');
  assert.ok(senior.sets <= 3);
  const lbs = suggestFor({ name: 'Leg Press', equipment: 'Machine' }, trainingContext({ weight: '180', weightUnit: 'lbs', goal: 'General fitness' }));
  assert.equal(lbs.unit, 'lbs');
  assert.equal(lbs.weight % 5, 0);
  assert.equal(prescriptionText(3, '', 40, 'kg'), '3 × — @ 40 kg');
  const pushUp = suggestFor({ name: 'Push-Up', equipment: 'Bodyweight', kind: 'compound' }, trainingContext({ goal: 'Build muscle' }));
  assert.equal(pushUp.reps, '8-20', 'unloaded work uses wider rep ranges taken near failure');
  assert.equal(prescriptionText(4, '8-12'), '4 × 8-12');
  assert.ok(sessionMinutes([{ sets: 3, restSets: 120, restNext: 150 }, { sets: 3, restSets: 75, restNext: 120 }]) >= 10);
});

test('every split and athlete program resolves to real exercises, adapted to home equipment', async () => {
  const { SPLITS, ATHLETES, EXERCISES, templateDays, adaptToEquipment } = await load('programCatalog.ts');
  assert.equal(SPLITS.length, 11);
  for (const program of [...SPLITS, ...ATHLETES]) for (const day of templateDays(program)) for (const key of day.items) assert.ok(EXERCISES[key], `${program.id}: ${key}`);
  assert.equal(adaptToEquipment('bench', ['Dumbbells']).equipment, 'Dumbbells');
  assert.equal(adaptToEquipment('leg_curl', ['Bodyweight only']).equipment, 'Bodyweight');
  assert.equal(adaptToEquipment('bench', ['Full gym']).key, 'bench');
  for (const key of Object.keys(EXERCISES)) assert.equal(adaptToEquipment(key, ['Bodyweight only']).equipment, 'Bodyweight', key);
  for (const key of Object.keys(EXERCISES)) assert.ok(['Dumbbells', 'Bodyweight'].includes(adaptToEquipment(key, ['Dumbbells']).equipment), key);
  assert.equal(adaptToEquipment('lateral', ['Bodyweight only', 'Resistance bands']).equipment, 'Resistance bands');
});
