export type MealName = 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner';
export type FoodEntry = { id: string; name: string; meal: MealName; calories: number | null; detail: string; time: string; source: 'Scanned' | 'Manual' | 'Barcode'; saturatedFat?: number | null; transFat?: number | null; fiber?: number | null; sugars?: number | null; addedSugar?: number | null; sodium?: number | null; cholesterol?: number | null; brand?: string; servingQuantity?: number; servingUnit?: string; barcode?: string; protein: number | null; carbs: number | null; fat: number | null; date?: string; fdcId?: number; estWeightG?: number; edited?: boolean };
export const nutritionTargets = { calories: 2300, protein: 140, carbs: 240, fats: 70 };
export const mealNames: MealName[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
export const sampleMeals: FoodEntry[] = [
  { id: 'sample-breakfast', name: 'Oats and eggs', meal: 'Breakfast', calories: 420, detail: 'Rolled oats · 1 cup · Egg · 2 large', time: '07:20', source: 'Scanned', protein: 28, carbs: 54, fat: 12 },
  { id: 'sample-lunch', name: 'Chicken rice bowl', meal: 'Lunch', calories: 680, detail: 'Chicken breast · 150 g · White rice · 1 cup', time: '12:40', source: 'Scanned', protein: 45, carbs: 82, fat: 15 },
  { id: 'sample-snack', name: 'Protein shake', meal: 'Snack', calories: 320, detail: 'Whey protein · 1 scoop · Banana · 1 medium', time: '15:10', source: 'Manual', protein: 23, carbs: 44, fat: 15 },
];
export const foodCatalog = [
  { name: 'Chicken breast, grilled', group: 'Poultry', per: 'per 100 g', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'Chicken thigh', group: 'Poultry', per: 'per 100 g', calories: 209, protein: 26, carbs: 0, fat: 10.9 },
  { name: 'White rice, cooked', group: 'Grains', per: 'per 100 g', calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name: 'Rolled oats', group: 'Grains', per: 'per 100 g', calories: 379, protein: 13, carbs: 68, fat: 6.5 },
  { name: 'Egg, whole', group: 'Dairy & eggs', per: 'per 1 large', calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { name: 'Banana', group: 'Fruit', per: 'per 1 medium', calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  // Filipino dishes
  { name: 'Pork adobo', group: 'Filipino', per: 'per 100 g', calories: 260, protein: 18, carbs: 3, fat: 19 },
  { name: 'Sinigang na baboy', group: 'Filipino', per: 'per 100 g', calories: 140, protein: 14, carbs: 8, fat: 7 },
  { name: 'Sinigang na isda', group: 'Filipino', per: 'per 100 g', calories: 110, protein: 16, carbs: 6, fat: 3 },
  { name: 'Lechon kawali', group: 'Filipino', per: 'per 100 g', calories: 350, protein: 20, carbs: 2, fat: 29 },
  { name: 'Sisig', group: 'Filipino', per: 'per 100 g', calories: 240, protein: 15, carbs: 6, fat: 18 },
  { name: 'Kare-kare', group: 'Filipino', per: 'per 100 g', calories: 280, protein: 14, carbs: 12, fat: 20 },
  { name: 'Lumpiang shanghai', group: 'Filipino', per: 'per 100 g', calories: 220, protein: 9, carbs: 18, fat: 12 },
  { name: 'Pancit canton', group: 'Filipino', per: 'per 100 g', calories: 190, protein: 8, carbs: 26, fat: 6 },
  { name: 'Pinakbet', group: 'Filipino', per: 'per 100 g', calories: 90, protein: 4, carbs: 10, fat: 4 },
  { name: 'Tinolang manok', group: 'Filipino', per: 'per 100 g', calories: 130, protein: 18, carbs: 5, fat: 4 },
  { name: 'Bistek Tagalog', group: 'Filipino', per: 'per 100 g', calories: 220, protein: 20, carbs: 8, fat: 11 },
  { name: 'Longganisa', group: 'Filipino', per: 'per 100 g', calories: 320, protein: 12, carbs: 2, fat: 28 },
  { name: 'Tocino', group: 'Filipino', per: 'per 100 g', calories: 340, protein: 14, carbs: 8, fat: 28 },
  { name: 'Tapa', group: 'Filipino', per: 'per 100 g', calories: 210, protein: 22, carbs: 4, fat: 10 },
  { name: 'Sinangag (garlic rice)', group: 'Filipino', per: 'per 100 g', calories: 160, protein: 3, carbs: 32, fat: 2 },
  { name: 'Bibingka', group: 'Filipino', per: 'per 100 g', calories: 240, protein: 6, carbs: 34, fat: 10 },
  { name: 'Puto', group: 'Filipino', per: 'per 100 g', calories: 200, protein: 5, carbs: 38, fat: 3 },
  { name: 'Turon', group: 'Filipino', per: 'per 100 g', calories: 250, protein: 3, carbs: 40, fat: 9 },
  { name: 'Mango, ripe', group: 'Fruit', per: 'per 100 g', calories: 60, protein: 0.8, carbs: 15, fat: 0.4 },
  { name: 'Papaya, green', group: 'Fruit', per: 'per 100 g', calories: 43, protein: 0.5, carbs: 11, fat: 0.3 },
  // Global dishes
  { name: 'Spaghetti bolognese', group: 'Italian', per: 'per 100 g', calories: 160, protein: 9, carbs: 15, fat: 6 },
  { name: 'Pizza margherita', group: 'Italian', per: 'per 100 g', calories: 250, protein: 11, carbs: 26, fat: 10 },
  { name: 'Beef burger', group: 'American', per: 'per 100 g', calories: 280, protein: 16, carbs: 22, fat: 14 },
  { name: 'Sushi roll', group: 'Japanese', per: 'per 100 g', calories: 180, protein: 5, carbs: 35, fat: 2 },
  { name: 'Pad thai', group: 'Thai', per: 'per 100 g', calories: 190, protein: 8, carbs: 25, fat: 6 },
  { name: 'Tacos al pastor', group: 'Mexican', per: 'per 100 g', calories: 200, protein: 11, carbs: 14, fat: 10 },
  { name: 'Falafel', group: 'Middle Eastern', per: 'per 100 g', calories: 330, protein: 13, carbs: 32, fat: 18 },
  { name: 'Hummus', group: 'Middle Eastern', per: 'per 100 g', calories: 170, protein: 5, carbs: 15, fat: 10 },
  { name: 'Greek salad', group: 'Mediterranean', per: 'per 100 g', calories: 110, protein: 3, carbs: 8, fat: 8 },
  { name: 'Butter chicken', group: 'Indian', per: 'per 100 g', calories: 240, protein: 14, carbs: 10, fat: 17 },
  { name: 'Samosa', group: 'Indian', per: 'per 100 g', calories: 260, protein: 5, carbs: 28, fat: 14 },
  { name: 'Dim sum dumpling', group: 'Chinese', per: 'per 100 g', calories: 200, protein: 8, carbs: 22, fat: 7 },
  { name: 'Pho', group: 'Vietnamese', per: 'per 100 g', calories: 80, protein: 5, carbs: 10, fat: 2 },
  { name: 'Croissant', group: 'French', per: 'per 100 g', calories: 400, protein: 7, carbs: 45, fat: 20 },
];
