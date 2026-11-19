import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../scripts/evaluate-food-scanner.mjs';

const food = (id, weight, kcal) => ({ id, name: id, weight_g: weight, nutrition: { kcal, carbs_g: null, protein_g: 0, fat_g: 1 } });
const synthetic = () => ({ dataset_kind: 'synthetic', meals: [{ id: 'meal', image: 'synthetic-only.jpg', categories: ['mixed', 'filipino'], ground_truth: [food('rice', 100, 130), food('egg', 50, 80)], predicted: [food('p1', 120, 156), food('p2', 50, 80), food('extra', 20, 10)], pairs: [{ truth_id: 'rice', prediction_id: 'p1', identity_correct: true, preparation_correct: true }, { truth_id: 'egg', prediction_id: 'p2', identity_correct: true, preparation_correct: false }] }] });

test('synthetic adjudication measures errors without accepting wrong preparation', () => {
  const report = evaluate(synthetic());
  assert.deepEqual([report.recognition.correct, report.recognition.incorrect, report.recognition.missing, report.recognition.extra], [1, 1, 0, 1]);
  assert.equal(report.recognition.complete_meals, 0);
  assert.equal(report.food_identity.correct, 2);
  assert.equal(report.preparation.accuracy, 0.5);
  assert.equal(report.preparation.evaluated, 2);
  assert.equal(report.weight_error_g.mean_absolute_error, 20);
  assert.equal(report.weight_percentage_error.median_absolute_error, 20);
  assert.equal(report.item_nutrition_absolute_error.kcal.mean_absolute_error, 26);
  assert.equal(report.meal_nutrition_absolute_error.kcal.mean_absolute_error, 36);
  assert.equal(report.item_nutrition_absolute_error.carbs_g.count, 0);
  assert.equal(report.by_category.filipino.weight_error_g.count, 1);
});
test('rejects duplicate matches and invalid measured weights', () => {
  const duplicate = synthetic(); duplicate.meals[0].pairs.push({ ...duplicate.meals[0].pairs[0] });
  assert.throws(() => evaluate(duplicate), /duplicate pair/);
  const invalid = synthetic(); invalid.meals[0].ground_truth[0].weight_g = 0;
  assert.throws(() => evaluate(invalid), /invalid ground truth item/);
});
test('empty dataset reports unavailable metrics rather than zero accuracy', () => {
  const report = evaluate({ meals: [] });
  assert.equal(report.recognition.precision, null);
  assert.equal(report.weight_error_g.mean_absolute_error, null);
});
test('recognition cases without measured weights do not invent quantity errors', () => {
  const data = synthetic();
  data.meals[0].ground_truth[0].weight_g = null;
  const report = evaluate(data);
  assert.equal(report.recognition.correct, 1);
  assert.equal(report.weight_error_g.count, 0);
  assert.equal(report.weight_error_g.matched_items_without_measured_weight, 1);
  assert.equal(report.weight_error_g.mean_absolute_error, null);
});
test('an absent prediction is not treated as a measured zero-calorie meal', () => {
  const data = synthetic();
  data.meals[0].predicted = [];
  data.meals[0].pairs = [];
  const report = evaluate(data);
  assert.equal(report.recognition.missing, 2);
  assert.equal(report.meal_nutrition_absolute_error.kcal.count, 0);
});
