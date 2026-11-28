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

export type CarbonPeriod = 'day' | 'week' | 'month' | 'year' | 'all';
type CarbonEntry = { name: string; date?: string; meal?: string; detail?: string; estWeightG?: number; servingSizeG?: number; servingQuantity?: number };
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Average petrol car, kg CO2e per km (UK DEFRA 2023), used only for an everyday comparison. */
export const CAR_KG_PER_KM = 0.17;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const utc = (year: number, month: number, day: number) => iso(new Date(Date.UTC(year, month, day, 12)));
const addDays = (day: string, count: number) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return iso(date); };
const monthsBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let year = Number(from.slice(0, 4)), month = Number(from.slice(5, 7)) - 1; `${year}-${String(month + 1).padStart(2, '0')}` <= to.slice(0, 7); month === 11 ? (year++, month = 0) : month++) out.push(`${year}-${String(month + 1).padStart(2, '0')}`);
  return out;
};

/** Calendar range for a period around `anchor` (YYYY-MM-DD): weeks start Monday; `previous` is the period before. */
function carbonRange(period: CarbonPeriod, anchor: string, dated: string[]) {
  const date = new Date(`${anchor}T12:00:00Z`), year = date.getUTCFullYear(), month = date.getUTCMonth();
  if (period === 'day') return { from: anchor, to: anchor, previous: { from: addDays(anchor, -1), to: addDays(anchor, -1) } };
  if (period === 'week') { const from = addDays(anchor, -((date.getUTCDay() + 6) % 7)); return { from, to: addDays(from, 6), previous: { from: addDays(from, -7), to: addDays(from, -1) } }; }
  if (period === 'month') return { from: utc(year, month, 1), to: utc(year, month + 1, 0), previous: { from: utc(year, month - 1, 1), to: utc(year, month, 0) } };
  if (period === 'year') return { from: `${year}-01-01`, to: `${year}-12-31`, previous: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` } };
  const first = dated.reduce((min, day) => day < min ? day : min, anchor), last = dated.reduce((max, day) => day > max ? day : max, anchor);
  return { from: first, to: last, previous: null };
}

/** Chart columns: meals for a day, days for a week or month, months for a year, months or years for all time. */
function carbonBuckets(period: CarbonPeriod, from: string, to: string) {
  if (period === 'day') return MEALS.map(meal => ({ key: meal, label: meal }));
  if (period === 'week') return WEEKDAYS.map((label, index) => ({ key: addDays(from, index), label: label[0] }));
  if (period === 'month') { const days = Number(to.slice(8, 10)); return Array.from({ length: days }, (_, index) => ({ key: addDays(from, index), label: String(index + 1) })); }
  const months = monthsBetween(from, to);
  if (period === 'year' || months.length <= 24) return months.map(key => ({ key, label: period === 'year' ? MONTHS[Number(key.slice(5)) - 1][0] : `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(2, 4)}` }));
  const years = [...new Set(months.map(key => key.slice(0, 4)))];
  return years.map(key => ({ key, label: key }));
}

/**
 * Food CO2e for one calendar period around `anchor`: total, change against the period before, top sources
 * with their share, chart columns and up to two local swaps. Only entries with a date are counted.
 */
export function carbonForPeriod(entries: CarbonEntry[], period: CarbonPeriod, anchor: string) {
  const dated = entries.flatMap(entry => entry.date ? [entry.date] : []);
  const { from, to, previous } = carbonRange(period, anchor, dated);
  const groups = new Map<string, number>(), buckets = carbonBuckets(period, from, to), bucketKg = new Map<string, number>();
  const keyLength = period === 'day' ? 0 : buckets[0]?.key.length ?? 10;
  const bucketKey = (entry: CarbonEntry) => period === 'day' ? (MEALS.includes(entry.meal ?? '') ? entry.meal! : 'Snack') : entry.date!.slice(0, keyLength);
  let totalKg = 0, previousKg = 0, foods = 0, undated = 0;
  const days = new Set<string>();
  for (const entry of entries) {
    // All time counts every log; one without a date (not yet synced) can't be charted or placed in a period.
    if (!entry.date) {
      if (period !== 'all') continue;
      const { group, kg } = foodCarbon(entry);
      totalKg += kg; foods++; undated++;
      groups.set(group, (groups.get(group) ?? 0) + kg);
      continue;
    }
    if (previous && entry.date >= previous.from && entry.date <= previous.to) previousKg += foodCarbon(entry).kg;
    if (entry.date < from || entry.date > to) continue;
    const { group, kg } = foodCarbon(entry);
    totalKg += kg; foods++; days.add(entry.date);
    groups.set(group, (groups.get(group) ?? 0) + kg);
    bucketKg.set(bucketKey(entry), (bucketKg.get(bucketKey(entry)) ?? 0) + kg);
  }
  const bySource = [...groups].map(([group, kg]) => ({ group, kg, share: totalKg ? kg / totalKg : 0 })).sort((a, b) => b.kg - a.kg);
  return {
    period, from, to, totalKg, foods, undated, daysLogged: days.size, firstLogged: dated.length ? dated.reduce((min, day) => day < min ? day : min) : null,
    perDayKg: days.size ? totalKg / days.size : 0,
    previousKg: previous ? previousKg : null,
    bySource,
    buckets: buckets.map(bucket => ({ ...bucket, kg: bucketKg.get(bucket.key) ?? 0 })),
    swaps: bySource.flatMap(row => ECO_SWAPS[row.group] ? [ECO_SWAPS[row.group]] : []).slice(0, 2),
    drivingKm: totalKg / CAR_KG_PER_KM,
  };
}
