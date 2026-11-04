import assert from 'node:assert/strict';
import test from 'node:test';
import { nutrientTotal } from '../sections/Scan/nutrientTotal.ts';

test('each nutrient is complete only when all included entries supply it', () => {
  const meals = [{ calories: 200, protein: 30, carbs: 0, fat: 8 }, { calories: 150, protein: 10, carbs: null, fat: 5 }, { calories: 100, protein: 5, carbs: 20, fat: null }];
  const total = (key, entries = meals) => nutrientTotal(entries, meal => meal[key]);
  assert.deepEqual(['calories', 'protein', 'carbs', 'fat'].map(key => total(key)), [450, 45, null, null]);
  assert.equal(total('carbs', meals.slice(0, 1)), 0);
  assert.equal(total('calories', []), 0);
});
