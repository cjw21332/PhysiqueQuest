export type MealName = 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner';
export type FoodEntry = { id: string; name: string; meal: MealName; calories: number; detail: string; time: string; source: 'Scanned' | 'Manual'; protein: number; carbs: number; fat: number; date?: string; fdcId?: number; edited?: boolean };
export const nutritionTargets = { calories: 2300, protein: 140, carbs: 240, fats: 70 };
export const mealNames: MealName[] = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
export const sampleMeals: FoodEntry[] = [
  { id: 'sample-breakfast', name: 'Oats and eggs', meal: 'Breakfast', calories: 420, detail: 'Rolled oats · 1 cup · Egg · 2 large', time: '07:20', source: 'Scanned', protein: 28, carbs: 54, fat: 12 },
  { id: 'sample-lunch', name: 'Chicken rice bowl', meal: 'Lunch', calories: 680, detail: 'Chicken breast · 150 g · White rice · 1 cup', time: '12:40', source: 'Scanned', protein: 45, carbs: 82, fat: 15 },
  { id: 'sample-snack', name: 'Protein shake', meal: 'Snack', calories: 320, detail: 'Whey protein · 1 scoop · Banana · 1 medium', time: '15:10', source: 'Manual', protein: 23, carbs: 44, fat: 15 },
];
export const foodCatalog = [
  { name: 'Chicken breast, grilled', group: 'Poultry', per: 'per 100 g', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'Chicken thigh', group: 'Poultry', per: 'per 100 g', calories: 209, protein: 26, carbs: 0, fat: 10.9 },
  { name: 'Chicken adobo', group: 'Cooked dish', per: 'per 100 g', calories: 190, protein: 23, carbs: 4, fat: 8 },
  { name: 'White rice, cooked', group: 'Grains', per: 'per 100 g', calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name: 'Rolled oats', group: 'Grains', per: 'per 100 g', calories: 379, protein: 13, carbs: 68, fat: 6.5 },
  { name: 'Egg, whole', group: 'Dairy & eggs', per: 'per 1 large', calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { name: 'Banana', group: 'Fruit', per: 'per 1 medium', calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
];
