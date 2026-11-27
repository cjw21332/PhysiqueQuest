// Approximate kg CO2e per kg of food (global medians, Poore & Nemecek 2018). Order matters: the first match wins,
// so specific meats come before dish names that could contain them (e.g. "chicken adobo" is chicken).
const FACTORS: [group: string, kgPerKg: number, words: RegExp][] = [
  ['Beef', 60, /\b(beef|steak|burger|baka|tapa|bulalo|kaldereta|kare-kare|corned)\b/],
  ['Lamb & goat', 24, /\b(lamb|mutton|goat|kambing)\b/],
  ['Shrimp', 12, /\b(shrimp|prawns?|hipon)\b/],
  ['Cheese', 21, /\b(cheese|keso)\b/],
  ['Chicken', 6, /\b(chicken|manok|tinola|inasal|turkey|poultry)\b/],
  ['Fish', 5, /\b(fish|isda|bangus|galunggong|tilapia|tuna|sardines?|sardinas|salmon|daing|tinapa)\b/],
  ['Pork', 7, /\b(pork|baboy|lechon|liempo|sisig|longganisa|tocino|bacon|ham|hotdog|sausage|adobo|sinigang)\b/],
  ['Eggs', 4.5, /\b(eggs?|itlog|balut)\b/],
  ['Rice', 4, /\b(rice|kanin|sinangag|lugaw|arroz|champorado)\b/],
  ['Milk & yogurt', 3, /\b(milk|gatas|yogh?urt|whey)\b/],
  ['Tofu & legumes', 1.5, /\b(tofu|tokwa|taho|monggo|mung|beans?|lentils?|chickpeas?|peanuts?|mani)\b/],
  ['Bread & grains', 1.4, /\b(bread|pandesal|oats?|pasta|noodles?|pancit|wheat|cereal)\b/],
  ['Fruit', 0.7, /\b(fruit|banana|saging|mango|mangga|papaya|apple|orange|pineapple)\b/],
  ['Vegetables & roots', 0.5, /\b(vegetables?|veggies|gulay|kangkong|malunggay|pechay|ampalaya|pinakbet|sitaw|salad|kamote|potato|cassava|kalabasa)\b/],
];
const DEFAULT_FACTOR = 2, DEFAULT_GRAMS = 150;

/** Lower-carbon swaps, keyed by the group they replace; local options first. */
export const ECO_SWAPS: Record<string, string> = {
  Beef: 'Swap beef for chicken, fish like bangus or galunggong, or tokwa: about 10× less CO₂e per serving.',
  'Lamb & goat': 'Try chicken or fish dishes instead of goat or lamb for a fraction of the emissions.',
  Cheese: 'Use less cheese, or pair meals with eggs or taho for protein.',
  Shrimp: 'Choose wild-caught local fish over farmed shrimp when you can.',
  Pork: 'Make some pork meals monggo, tokwa or fish days instead.',
  Rice: 'Mix in kamote, saba or corn for part of your rice, and avoid wasting leftover kanin.',
};

export function foodCarbon(entry: { name: string; detail?: string; estWeightG?: number; servingSizeG?: number; servingQuantity?: number }) {
  const text = `${entry.name} ${entry.detail ?? ''}`.toLowerCase();
  const [group, factor] = FACTORS.find(([, , words]) => words.test(text)) ?? ['Other foods', DEFAULT_FACTOR];
  const grams = entry.estWeightG ?? (entry.servingSizeG ? entry.servingSizeG * (entry.servingQuantity || 1) : DEFAULT_GRAMS);
  return { group, kg: (Math.min(Math.max(grams, 0), 3000) / 1000) * factor };
}

/** CO2e of foods logged in the 7 days ending on `today` (YYYY-MM-DD), grouped by source, largest first. */
export function weeklyFoodCarbon(entries: { name: string; date?: string; detail?: string; estWeightG?: number; servingSizeG?: number; servingQuantity?: number }[], today: string) {
  const start = new Date(`${today}T12:00:00Z`); start.setUTCDate(start.getUTCDate() - 6);
  const from = start.toISOString().slice(0, 10);
  const groups = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.date || entry.date < from || entry.date > today) continue;
    const { group, kg } = foodCarbon(entry);
    groups.set(group, (groups.get(group) ?? 0) + kg);
  }
  const bySource = [...groups].map(([group, kg]) => ({ group, kg })).sort((a, b) => b.kg - a.kg);
  return { totalKg: bySource.reduce((sum, row) => sum + row.kg, 0), bySource, swaps: bySource.flatMap(row => ECO_SWAPS[row.group] ? [ECO_SWAPS[row.group]] : []).slice(0, 2) };
}
