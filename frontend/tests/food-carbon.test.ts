import assert from 'node:assert/strict';
import test from 'node:test';
import { carbonForPeriod, foodCarbon } from '../lib/foodCarbon.ts';

test('foods map to carbon groups, including Filipino dish names', () => {
  assert.equal(foodCarbon({ name: 'Beef tapa' }).group, 'Beef');
  assert.equal(foodCarbon({ name: 'Chicken adobo' }).group, 'Chicken');
  assert.equal(foodCarbon({ name: 'Pork adobo' }).group, 'Pork');
  assert.equal(foodCarbon({ name: 'Ginisang monggo' }).group, 'Tofu & legumes');
  assert.equal(foodCarbon({ name: 'Mystery plate' }).group, 'Other foods');
  assert.ok(Math.abs(foodCarbon({ name: 'Steak', estWeightG: 200 }).kg - 12) < 1e-9);
});

// Saturday 2026-11-28; its week runs Monday 23 to Sunday 29.
const LOG = [
  { name: 'Beef steak', meal: 'Dinner', date: '2026-11-28', estWeightG: 200 },   // 12 kg
  { name: 'Rice', meal: 'Lunch', date: '2026-11-28', estWeightG: 250 },          // 1 kg
  { name: 'Chicken adobo', meal: 'Lunch', date: '2026-11-27', estWeightG: 500 }, // 3 kg (yesterday)
  { name: 'Beef burger', meal: 'Dinner', date: '2026-11-20', estWeightG: 200 },  // 12 kg (last week)
  { name: 'Kangkong', meal: 'Lunch', date: '2026-10-02', estWeightG: 1000 },     // 0.5 kg (last month)
  { name: 'Rice', meal: 'Lunch', date: '2025-06-01', estWeightG: 500 },          // 2 kg (last year)
  { name: 'Undated', estWeightG: 100 },
];
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test('day footprint is grouped by meal and compared with the day before', () => {
  const day = carbonForPeriod(LOG, 'day', '2026-11-28');
  near(day.totalKg, 13);
  near(day.previousKg!, 3);
  assert.deepEqual(day.buckets.map(row => [row.key, row.kg]), [['Breakfast', 0], ['Lunch', 1], ['Dinner', 12], ['Snack', 0]]);
  assert.deepEqual(day.bySource.map(row => row.group), ['Beef', 'Rice']);
  near(day.bySource[0].share, 12 / 13);
  assert.match(day.swaps[0], /bangus/);
  near(day.drivingKm, 13 / 0.17);
});

test('week, month and year use calendar periods around the chosen day', () => {
  const week = carbonForPeriod(LOG, 'week', '2026-11-28');
  assert.deepEqual([week.from, week.to], ['2026-11-23', '2026-11-29']);
  near(week.totalKg, 16);
  near(week.previousKg!, 12);
  assert.equal(week.buckets.length, 7);
  assert.equal(week.daysLogged, 2);
  near(week.perDayKg, 8);

  const month = carbonForPeriod(LOG, 'month', '2026-11-28');
  assert.deepEqual([month.from, month.to, month.buckets.length], ['2026-11-01', '2026-11-30', 30]);
  near(month.totalKg, 28);
  near(month.previousKg!, 0.5);

  const year = carbonForPeriod(LOG, 'year', '2026-11-28');
  assert.equal(year.buckets.length, 12);
  near(year.totalKg, 28.5);
  near(year.previousKg!, 2);
  near(year.buckets[10].kg, 28);
});

test('all time counts every log, even one without a date, has no comparison, and charts months', () => {
  const all = carbonForPeriod(LOG, 'all', '2026-11-28');
  near(all.totalKg, 30.7); // 30.5 kg dated + 0.2 kg for the undated 100 g "other food"
  assert.equal(all.previousKg, null);
  assert.equal(all.foods, 7);
  assert.equal(all.undated, 1);
  assert.equal(all.firstLogged, '2025-06-01');
  assert.equal(carbonForPeriod(LOG, 'all', '2024-01-01').foods, 7, 'picking an earlier day never hides later logs');
  assert.deepEqual([all.buckets[0].key, all.buckets.at(-1)!.key], ['2025-06', '2026-11']);
  near(all.buckets.reduce((sum, row) => sum + row.kg, 0), 30.5);
  assert.equal(carbonForPeriod([], 'day', '2026-11-28').totalKg, 0);
});
