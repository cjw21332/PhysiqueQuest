import assert from 'node:assert/strict';
import test from 'node:test';
import { foodCarbon, weeklyFoodCarbon } from '../lib/foodCarbon.ts';

test('foods map to carbon groups, including Filipino dish names', () => {
  assert.equal(foodCarbon({ name: 'Beef tapa' }).group, 'Beef');
  assert.equal(foodCarbon({ name: 'Chicken adobo' }).group, 'Chicken');
  assert.equal(foodCarbon({ name: 'Pork adobo' }).group, 'Pork');
  assert.equal(foodCarbon({ name: 'Ginisang monggo' }).group, 'Tofu & legumes');
  assert.equal(foodCarbon({ name: 'Mystery plate' }).group, 'Other foods');
  assert.ok(Math.abs(foodCarbon({ name: 'Steak', estWeightG: 200 }).kg - 12) < 1e-9);
});

test('weekly footprint counts only the last 7 days and suggests swaps for the biggest sources', () => {
  const week = weeklyFoodCarbon([
    { name: 'Beef steak', date: '2026-11-27', estWeightG: 200 },
    { name: 'Rice', date: '2026-11-21', estWeightG: 250 },
    { name: 'Beef burger', date: '2026-11-20', estWeightG: 200 },
    { name: 'Kangkong', estWeightG: 100 },
  ], '2026-11-27');
  assert.deepEqual(week.bySource.map(row => row.group), ['Beef', 'Rice']);
  assert.ok(Math.abs(week.totalKg - 13) < 1e-9);
  assert.equal(week.swaps.length, 2);
  assert.match(week.swaps[0], /bangus/);
});
