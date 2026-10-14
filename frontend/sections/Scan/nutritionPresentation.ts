import type { FoodCandidate, FoodDetail, ScanAnalysis, ScannedItem } from '../../lib/api';
import type { FoodEntry } from './types';

export function canPreviewNutrition(loading: boolean, error: string, meals: Pick<FoodEntry, 'id'>[], water: number) {
  return !loading && !error && meals.length === 0 && water === 0;
}
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
// Deliberate reference fixtures. These IDs must never be sent to persistence APIs.
export function createNutritionPreview(now = new Date()): { meals: FoodEntry[]; water: number } {
  const date = dateKey(now);
  const meals: FoodEntry[] = [
    { id: 'preview-breakfast', name: 'Oats and eggs', meal: 'Breakfast', calories: 420, detail: 'Rolled oats · 1 cup · Egg · 2 large', time: '07:20', source: 'Scanned', protein: 28, carbs: 54, fat: 12, date },
    { id: 'preview-lunch', name: 'Chicken rice bowl', meal: 'Lunch', calories: 680, detail: 'Chicken breast · 150 g · White rice · 1 cup', time: '12:40', source: 'Scanned', edited: true, protein: 45, carbs: 82, fat: 15, date },
    { id: 'preview-snack', name: 'Protein shake', meal: 'Snack', calories: 320, detail: 'Whey protein · 1 scoop · Banana · 1 medium', time: '15:10', source: 'Manual', protein: 23, carbs: 44, fat: 15, date },
  ];
  [2160, 1990, 2550, 1760, 2160, 1589].forEach((calories, index) => {
    const day = new Date(now); day.setDate(day.getDate() - (6 - index));
    meals.push({ id: `preview-history-${index}`, name: 'Daily meal total', meal: 'Dinner', calories, detail: 'Reference meal log', time: '18:30', source: 'Manual', protein: calories * .28 / 4, carbs: calories * .47 / 4, fat: calories * .25 / 9, date: dateKey(day) });
  });
  return { meals, water: 5 };
}

export function summarizeHistory(meals: FoodEntry[], range: number, now = new Date()) {
  const days = Array.from({ length: range }, (_, index) => { const day = new Date(now); day.setDate(day.getDate() - (range - index - 1)); return dateKey(day); });
  const visible = meals.filter(entry => !!entry.date && days.includes(entry.date));
  const daily = days.map(date => ({ date, calories: visible.filter(entry => entry.date === date).reduce((sum, entry) => sum + entry.calories, 0) }));
  const logged = daily.filter(entry => entry.calories > 0);
  const average = logged.length ? Math.round(logged.reduce((sum, day) => sum + day.calories, 0) / logged.length) : 0;
  const energy = visible.reduce((sum, item) => ({ protein: sum.protein + item.protein * 4, carbs: sum.carbs + item.carbs * 4, fat: sum.fat + item.fat * 9 }), { protein: 0, carbs: 0, fat: 0 });
  const total = energy.protein + energy.carbs + energy.fat;
  const split = { protein: total ? Math.round(energy.protein / total * 100) : 0, carbs: total ? Math.round(energy.carbs / total * 100) : 0, fat: total ? Math.round(energy.fat / total * 100) : 0 };
  return { daily, visible, average, split };
}

export const previewFoods: (FoodCandidate & { detail: FoodDetail })[] = [
  ['Chicken breast, grilled', 'Poultry', 165, 31, 0, 3.6],
  ['Chicken thigh', 'Poultry', 209, 26, 0, 10.9],
  ['Chicken adobo', 'Cooked dish', 190, 23, 4, 8],
  ['White rice, cooked', 'Grains', 130, 2.7, 28, .3],
  ['Egg, whole', 'Dairy & eggs', 143, 12.6, .8, 9.6],
  ['Banana', 'Fruit', 89, 1.1, 23, .3],
].map(([name, group, kcal, protein, carbs, fat], index) => ({
  fdc_id: -100 - index, description: String(name), data_type: String(group),
  detail: { request_id: 'local-preview', fdc_id: -100 - index, description: String(name), data_type: String(group), serving_size_g: 100,
    per_100g: { kcal: Number(kcal), protein_g: Number(protein), carbs_g: Number(carbs), fat_g: Number(fat) } },
}));

export const previewScan: ScanAnalysis = {
  request_id: 'local-preview', model: 'Reference preview', unmatched: [], degraded: false,
  items: [
    { food_name: 'Grilled chicken breast', found: true, fdc_id: -100, est_weight_g: 150, confidence: .92, kcal: 248, protein_g: 40, carbs_g: 0, fat_g: 8 },
    { food_name: 'Steamed rice', found: true, fdc_id: -103, est_weight_g: 158, description: '1 cup', confidence: .85, kcal: 205, protein_g: 4, carbs_g: 45, fat_g: 2 },
    { food_name: 'Mixed vegetables', found: true, fdc_id: -106, est_weight_g: 80, confidence: .61, kcal: 167, protein_g: 4, carbs_g: 23, fat_g: 10 },
  ], totals: { kcal: 620, protein_g: 48, carbs_g: 68, fat_g: 20 },
};
export function scaleScannedItems(items: ScannedItem[], factor: number) {
  return items.map(item => ({ ...item, est_weight_g: item.est_weight_g * factor, kcal: item.kcal * factor, protein_g: item.protein_g * factor, carbs_g: item.carbs_g * factor, fat_g: item.fat_g * factor }));
}
