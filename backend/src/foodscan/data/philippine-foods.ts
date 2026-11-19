/** Source records supplied for review. Null means that a nutrient has not been verified. */
export interface PhilippineFoodRecord {
  id: string; canonicalName: string; filipinoName: string; aliases: string[]; category: string;
  kcal: number | null; protein: number | null; carbs: number | null; fat: number | null;
  servingDescription: string | null; servingGrams: number | null;
  source: string; sourceRef: string; isEstimated: boolean; verifiedAt: string | null;
}

export function validatePhilippineFood(record: PhilippineFoodRecord): PhilippineFoodRecord {
  if (!record.id.trim() || !record.canonicalName.trim() || !record.source.trim() || !record.sourceRef.trim()) throw new Error('Food records require an id, name, source and source reference');
  for (const value of [record.kcal, record.protein, record.carbs, record.fat, record.servingGrams]) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error('Invalid food record value');
  }
  return record;
}

// R047 values were supplied by the user. Carbohydrate awaits independent verification.
export const philippineFoodSeed: PhilippineFoodRecord[] = [validatePhilippineFood({
  id: 'pork-chicken-adobo-canned', canonicalName: 'Pork & chicken adobo, canned', filipinoName: 'Adobong baboy at manok',
  aliases: ['adobo'], category: 'ulam', kcal: 189, protein: 14.5, carbs: null, fat: 14.6,
  servingDescription: null, servingGrams: null, source: 'PhilFCT', sourceRef: 'R047', isEstimated: false, verifiedAt: null,
})];
