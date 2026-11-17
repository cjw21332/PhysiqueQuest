import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Pairings are adjudicated independently; name similarity must not award a
// correct identification to a wrong preparation or a component of a dish.
const nutrients = ['kcal', 'carbs_g', 'protein_g', 'fat_g'];
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const median = values => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const n = sorted.length; return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2; };
const stats = values => ({ count: values.length, mean_absolute_error: mean(values), median_absolute_error: median(values) });
const record = (condition, message) => { if (!condition) throw new Error(message); };

export function evaluate(dataset) {
  record(dataset && Array.isArray(dataset.meals), 'meals must be an array');
  const ids = new Set(), totals = { ground_truth: 0, predicted: 0, correct: 0, incorrect: 0, missing: 0, extra: 0, correct_preparation: 0, evaluated_preparation: 0, complete_meals: 0 }, grams = [], percentages = [], nutrition = Object.fromEntries(nutrients.map(k => [k, []])), meals = Object.fromEntries(nutrients.map(k => [k, []])), byCategory = {};
  for (const meal of dataset.meals) {
    record(typeof meal.id === 'string' && meal.id && !ids.has(meal.id), 'meal id must be unique'); ids.add(meal.id);
    record(Array.isArray(meal.categories) && meal.categories.length && meal.categories.every(x => typeof x === 'string' && x), `${meal.id}: categories required`);
    record(typeof meal.image === 'string' && meal.image.length > 0, `${meal.id}: image path required`);
    record(Array.isArray(meal.ground_truth) && Array.isArray(meal.predicted) && Array.isArray(meal.pairs), `${meal.id}: arrays required`);
    const truth = new Map(), predictions = new Map();
    for (const [array, map, kind] of [[meal.ground_truth, truth, 'ground truth'], [meal.predicted, predictions, 'prediction']]) for (const item of array) {
      record(typeof item.id === 'string' && item.id && !map.has(item.id), `${meal.id}: duplicate ${kind} id`);
      record(typeof item.name === 'string' && item.name.trim() && finite(item.weight_g) && item.weight_g > 0, `${meal.id}: invalid ${kind} item`);
      for (const key of nutrients) record(item.nutrition?.[key] == null || finite(item.nutrition[key]), `${meal.id}: invalid ${kind} ${key}`);
      map.set(item.id, item);
    }
    const usedTruth = new Set(), usedPred = new Set(); let correct = 0, incorrect = 0;
    const localGrams = [];
    for (const pair of meal.pairs) {
      record(truth.has(pair.truth_id) && predictions.has(pair.prediction_id), `${meal.id}: unknown pair id`);
      record(!usedTruth.has(pair.truth_id) && !usedPred.has(pair.prediction_id), `${meal.id}: duplicate pair`);
      record(typeof pair.identity_correct === 'boolean' && (pair.preparation_correct === null || typeof pair.preparation_correct === 'boolean'), `${meal.id}: pair requires explicit adjudication`);
      usedTruth.add(pair.truth_id); usedPred.add(pair.prediction_id);
      if (pair.identity_correct && pair.preparation_correct !== null) { totals.evaluated_preparation++; if (pair.preparation_correct) totals.correct_preparation++; }
      if (!pair.identity_correct || pair.preparation_correct !== true) { incorrect++; continue; }
      correct++; const actual = truth.get(pair.truth_id), predicted = predictions.get(pair.prediction_id), error = Math.abs(predicted.weight_g - actual.weight_g);
      grams.push(error); localGrams.push(error); percentages.push(error / actual.weight_g * 100);
      for (const key of nutrients) if (finite(actual.nutrition?.[key]) && finite(predicted.nutrition?.[key])) nutrition[key].push(Math.abs(predicted.nutrition[key] - actual.nutrition[key]));
    }
    const missing = truth.size - usedTruth.size, extra = predictions.size - usedPred.size;
    totals.ground_truth += truth.size; totals.predicted += predictions.size; totals.correct += correct; totals.incorrect += incorrect; totals.missing += missing; totals.extra += extra;
    if (!missing && !extra && !incorrect) totals.complete_meals++;
    for (const key of nutrients) {
      const actual = [...truth.values()].map(x => x.nutrition?.[key]), pred = [...predictions.values()].map(x => x.nutrition?.[key]);
      if (actual.every(finite) && pred.every(finite)) meals[key].push(Math.abs(pred.reduce((a,b) => a+b, 0) - actual.reduce((a,b) => a+b, 0)));
    }
    for (const category of new Set(meal.categories)) { const bucket = byCategory[category] ??= { meals: 0, correct: 0, incorrect: 0, missing: 0, extra: 0, weight_absolute_errors_g: [] }; bucket.meals++; bucket.correct += correct; bucket.incorrect += incorrect; bucket.missing += missing; bucket.extra += extra; bucket.weight_absolute_errors_g.push(...localGrams); }
  }
  for (const bucket of Object.values(byCategory)) { bucket.weight_error_g = stats(bucket.weight_absolute_errors_g); delete bucket.weight_absolute_errors_g; }
  return { dataset_kind: dataset.dataset_kind ?? 'unspecified', meal_count: dataset.meals.length, recognition: { ...totals, precision: totals.predicted ? totals.correct / totals.predicted : null, recall: totals.ground_truth ? totals.correct / totals.ground_truth : null }, weight_error_g: stats(grams), weight_percentage_error: stats(percentages), item_nutrition_absolute_error: Object.fromEntries(nutrients.map(k => [k, stats(nutrition[k])])), meal_nutrition_absolute_error: Object.fromEntries(nutrients.map(k => [k, stats(meals[k])])), by_category: byCategory };
}

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input) throw new Error('Usage: node scripts/evaluate-food-scanner.mjs dataset.json [report.json]');
  const result = evaluate(JSON.parse(await readFile(input, 'utf8')));
  const rendered = JSON.stringify(result, null, 2) + '\n';
  if (output) await writeFile(output, rendered); else process.stdout.write(rendered);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { process.stderr.write(`Evaluation failed: ${error.message}\n`); process.exitCode = 1; });
