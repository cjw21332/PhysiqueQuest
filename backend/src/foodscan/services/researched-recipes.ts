/** Reviewed recipe estimate, not a measured value for the photographed meal.
 * Source: Philippine BJMP food-service standards, Sinigang na Baboy recipe,
 * https://r5.bjmp.gov.ph/wp-content/uploads/2022/01/20-MC-106_10282020_MC_ON_FOOD_SERVICE_MANAGEMENT_REVISED_STANDARDS_ON_FOOD_SERVICE_MANAGEMENT_AS_AMENDED_2020_compressed.pdf
 * Recipe table reports 1,363.6 g for five servings and total estimated
 * 1,132 kcal, 50.4 g protein, 23.1 g carbs and 93 g fat. The stated
 * serving weight is 272.72 g; scale recipe totals by this reported weight.
 * Actual preparation and cooked yield can differ substantially.
 */
const recipe = {
  nutrition_ref: 'recipe:bjmp-pork-sinigang',
  description: 'Pork sinigang · Philippine food-service recipe estimate',
  source: 'Philippine food-service recipe estimate',
  dataType: 'Recipe estimate',
  reference_ingredients: ['Pork belly', 'Water', 'String beans', 'Water spinach', 'Onion', 'Tomato', 'Cooking oil', 'Sinigang mix', 'Salt'],
  kcal_per_100g: 1132 / 1363.6 * 100,
  protein_g_per_100g: 50.4 / 1363.6 * 100,
  carbs_g_per_100g: 23.1 / 1363.6 * 100,
  fat_g_per_100g: 93 / 1363.6 * 100,
};

export function researchedRecipeByName(name: string, aliases: string[] = []) {
  const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  const primary = normalize(name);
  // Never infer the protein from an alias alone, or substitute a different meat.
  if (!/\b(?:pork|baboy)\b/.test(primary) || /\b(?:chicken|manok|beef|baka|shrimp|hipon|fish|isda|without|no)\b/.test(primary)) return undefined;
  const names = [primary, ...aliases.map(normalize)];
  return names.some(value => /\b(?:pork|baboy)\b/.test(value) && /\bsinigang\b/.test(value) && !/\b(?:chicken|manok|beef|baka|shrimp|hipon|fish|isda|without|no)\b/.test(value)) ? recipe : undefined;
}

export function researchedRecipeById(id: string) {
  return id === recipe.nutrition_ref ? recipe : undefined;
}
