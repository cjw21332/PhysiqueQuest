/** Search aliases only; these are not nutrition records. */
const aliases: Record<string, string> = {
  kanin: 'cooked white rice', itlog: 'egg', manok: 'chicken', baboy: 'pork',
  baka: 'beef', isda: 'fish', hipon: 'shrimp', gulay: 'vegetables',
  'adobong manok': 'chicken adobo', 'adobong baboy': 'pork adobo',
  // Common names for the edible pod; explicitly request its cooked form so
  // raw or mature-seed USDA records are not substituted for a served meal.
  'long beans': 'yardlong bean cooked', 'long bean': 'yardlong bean cooked',
  sitaw: 'yardlong bean cooked', 'yardlong beans': 'yardlong bean cooked',
};

export function foodSearchTerms(value: string): string[] {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  const translated = aliases[normalized];
  return translated ? [translated, normalized] : [normalized];
}
