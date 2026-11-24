/**
 * Visual identity for every badge: the category picks the crest silhouette and colour,
 * the tier picks the rim metal, the glyph sits in the middle and the label names the milestone.
 */
export type BadgeCategory = 'personal' | 'rhythm' | 'forge' | 'iron' | 'fuel' | 'questline' | 'ascension';
export type BadgeTier = 'common' | 'rare' | 'epic' | 'legendary';

export const BADGE_CATEGORIES: { id: BadgeCategory; name: string; tagline: string; hue: string; glyph: string }[] = [
  { id: 'personal', name: 'Yours alone', tagline: 'Earned from your own plan, goal and body. No one else has these targets.', hue: '#b57bff', glyph: 'user' },
  { id: 'rhythm', name: 'Rhythm', tagline: 'Showing up, day after day.', hue: '#ff8a3d', glyph: 'fire' },
  { id: 'forge', name: 'The Forge', tagline: 'Workouts, timing, variety and effort.', hue: '#22c55e', glyph: 'dumbbell' },
  { id: 'iron', name: 'Iron', tagline: 'Records, heavy lifts and total volume moved.', hue: '#7aa2ff', glyph: 'strength' },
  { id: 'fuel', name: 'Fuel', tagline: 'Hydration and nutrition that power training.', hue: '#2fd3c4', glyph: 'water' },
  { id: 'questline', name: 'Questline', tagline: 'Daily missions and weekly challenges conquered.', hue: '#f5b83d', glyph: 'goal-milestones' },
  { id: 'ascension', name: 'Ascension', tagline: 'Levels and leaderboard standing.', hue: '#f2c14e', glyph: 'crown' },
];

export const TIER_LABEL: Record<BadgeTier, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
export const TIER_ORDER: BadgeTier[] = ['legendary', 'epic', 'rare', 'common'];

type Meta = { category: BadgeCategory; tier: BadgeTier; glyph: string; label?: string };
const tierBy = (value: number, steps: [number, BadgeTier][], base: BadgeTier = 'common'): BadgeTier => steps.reduce<BadgeTier>((tier, [min, next]) => value >= min ? next : tier, base);
const short = (n: number) => n >= 1000 ? `${n / 1000}k` : String(n);

const FIXED: Record<string, Meta> = {
  'seven-suns': { category: 'rhythm', tier: 'epic', glyph: 'sun', label: '7/7' },
  'weekend-vanguard': { category: 'rhythm', tier: 'rare', glyph: 'calendar' },
  'first-workout': { category: 'forge', tier: 'common', glyph: 'dumbbell', label: '1' },
  'early-bird': { category: 'forge', tier: 'rare', glyph: 'sunrise' },
  'night-owl': { category: 'forge', tier: 'rare', glyph: 'star' },
  'phoenix': { category: 'forge', tier: 'epic', glyph: 'trend' },
  'personal-record': { category: 'iron', tier: 'common', glyph: 'trophy', label: 'PR' },
  'macro-master': { category: 'fuel', tier: 'epic', glyph: 'meal' },
  'summit': { category: 'personal', tier: 'legendary', glyph: 'scale' },
  'level-beginner': { category: 'ascension', tier: 'common', glyph: 'medal', label: 'Lv 1' },
  'level-amateur': { category: 'ascension', tier: 'rare', glyph: 'medal', label: 'Lv 5' },
  'level-pro': { category: 'ascension', tier: 'epic', glyph: 'medal', label: 'Lv 15' },
  'level-veteran': { category: 'ascension', tier: 'legendary', glyph: 'medal', label: 'Lv 30' },
};

export function badgeMeta(id: string): Meta {
  if (FIXED[id]) return FIXED[id];
  const [, family, raw] = /^([a-z-]+?)-(\d+)$/.exec(id) ?? [];
  const n = Number(raw);
  switch (family) {
    case 'streak': return { category: 'rhythm', tier: tierBy(n, [[7, 'rare'], [30, 'epic'], [100, 'legendary']]), glyph: 'fire', label: String(n) };
    case 'workouts': return { category: 'forge', tier: tierBy(n, [[10, 'rare'], [50, 'epic'], [100, 'legendary']]), glyph: 'dumbbell', label: String(n) };
    case 'variety': return { category: 'forge', tier: n >= 25 ? 'epic' : 'rare', glyph: 'exercise-books', label: String(n) };
    case 'calories': return { category: 'forge', tier: tierBy(n, [[1000, 'rare'], [10000, 'epic'], [100000, 'legendary']]), glyph: 'pulse', label: short(n) };
    case 'lift': return { category: 'iron', tier: tierBy(n, [[100, 'epic'], [150, 'legendary']], 'rare'), glyph: 'strength', label: `${n}kg` };
    case 'volume': return { category: 'iron', tier: tierBy(n, [[50000, 'rare'], [250000, 'epic']]), glyph: 'chart-bars', label: short(n) };
    case 'hydration': return { category: 'fuel', tier: tierBy(n, [[7, 'rare'], [50, 'epic'], [100, 'legendary']]), glyph: 'water', label: String(n) };
    case 'goal': return { category: 'questline', tier: tierBy(n, [[7, 'rare'], [14, 'epic'], [30, 'legendary']]), glyph: 'goal-milestones', label: String(n) };
    case 'gauntlet': return { category: 'questline', tier: tierBy(n, [[4, 'epic'], [12, 'legendary']], 'rare'), glyph: 'shield', label: `${n}w` };
    case 'oath': return { category: 'personal', tier: tierBy(n, [[4, 'epic'], [12, 'legendary']], 'rare'), glyph: 'calendar', label: `${n}w` };
    case 'self-made': return { category: 'personal', tier: tierBy(n, [[4, 'epic'], [12, 'legendary']], 'rare'), glyph: 'user', label: `${n}w` };
    case 'top': return { category: 'ascension', tier: n === 1 ? 'legendary' : n <= 10 ? 'epic' : 'rare', glyph: 'crown', label: `#${n}` };
    default: return { category: 'questline', tier: 'common', glyph: 'medal' };
  }
}
