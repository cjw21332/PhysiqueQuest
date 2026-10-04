import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('admin exercise library uses protected API records and reports denied access', async () => {
  const screen = await source('sections/Me Section/AdminExerciseLibrary.tsx');
  const api = await source('lib/api.ts');
  assert.match(screen, /api\.getAdminExercises/);
  assert.match(screen, /api\.createAdminExercise/);
  assert.match(screen, /Not authorized|forbidden/i);
  assert.doesNotMatch(screen, /initialExercises/);
  assert.match(api, /\/admin\/exercises/);
});
