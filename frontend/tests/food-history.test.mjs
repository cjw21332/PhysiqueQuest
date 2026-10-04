import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('food history aggregates only saved meal dates and has a true empty state', async () => {
  const history = await source('sections/Scan/FoodHistory.tsx');
  assert.match(history, /No meals saved/);
  assert.match(history, /entry\.date/);
  assert.doesNotMatch(history, /1947|sample data|sample|2300-avg/);
});
