import { ageBand, scheduledWeekdays } from '../coach/coach-planner.js';

/** Per-day evidence keyed by YYYY-MM-DD in the user's timezone. */
export type DayData = {
  workouts: Set<string>;
  records: Set<string>;
  active: Set<string>;
  water: Map<string, number>;
  protein: Map<string, number>;
  mealsDone: (date: string) => boolean;
  /** Days with a saved weight check-in. */
  weighIns?: Set<string>;
  /** Logged calories per day, and the saved dietary plan's daily target. */
  calories?: Map<string, number>;
  calorieTarget?: number | null;
};
export type QuestProfile = { age?: string; weight?: string; weightUnit?: string; goal?: string; targetWeight?: string; days?: string[]; injuries?: string[]; healthRisks?: string[]; conditions?: string[]; healthConsentAt?: Date };
export type Quest = { key: string; title: string; target: number; progress: number; points: number; complete: boolean; reason?: string };

export const shiftDate = (date: string, days: number) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10); };
/** Weeks start on Monday. */
export const weekStart = (date: string) => shiftDate(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
const weekDays = (start: string, until: string) => Array.from({ length: 7 }, (_, index) => shiftDate(start, index)).filter(date => date <= until);
const weekdayIndex = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const quest = (key: string, title: string, target: number, progress: number, points: number, reason: string): Quest =>
  ({ key, title, target, points, progress: Math.min(progress, target), complete: progress >= target, reason });
const days = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`;

/**
 * Journey quests built from the user's own plan, goal, body and health. They deliberately use evidence
 * the shared lists never touch (planned weekdays, calorie and protein targets, weigh-ins, rest),
 * so they never repeat a daily mission or weekly challenge.
 */
export function personalQuests(profile: QuestProfile | null, data: DayData, start: string, until: string): Quest[] {
  if (!profile) return [];
  const week = weekDays(start, until);
  const count = (test: (date: string) => boolean) => week.filter(test).length;
  // Health data counts only with consent, as in Coach.
  const health = profile.healthConsentAt ? [...(profile.injuries ?? []), ...(profile.healthRisks ?? []), ...(profile.conditions ?? [])] : [];
  const goal = profile.goal ?? '';
  const kg = Number.parseFloat(profile.weight ?? '') * (profile.weightUnit === 'lbs' ? 0.45359237 : 1);
  const targetWeight = Number.parseFloat(profile.targetWeight ?? '');
  const unit = profile.weightUnit === 'lbs' ? 'lbs' : 'kg';
  const quests: Quest[] = [];

  // 1. The plan: only workouts on the weekdays the user chose count.
  const planned = profile.days?.length ? scheduledWeekdays(profile.days) : new Set<number>();
  if (planned.size) {
    const labels = WEEKDAY_LABELS.filter((_, index) => planned.has(index)).join(' · ');
    quests.push(quest('plan', 'Show up on your planned days', planned.size, count(date => planned.has(weekdayIndex(date)) && data.workouts.has(date)), 200, `You planned ${labels}`));
  }

  // 2. The goal.
  if (/muscle|strength/i.test(goal) && Number(profile.age) >= 18 && !health.length && kg >= 30 && kg <= 300) {
    // 1.6 g/kg is the usual muscle-gain target; skipped for minors and anyone with a health condition on file.
    const grams = Math.round(kg * 1.6 / 5) * 5;
    quests.push(quest('protein', `Hit ${grams} g of protein on 4 days`, 4, count(date => (data.protein.get(date) ?? 0) >= grams), 150, `1.6 g per kg of your ${Math.round(kg)} kg body weight`));
  } else if (/weight loss/i.test(goal) && data.calorieTarget && data.calorieTarget > 0) {
    const target = data.calorieTarget;
    quests.push(quest('calories', 'Stay within your calorie target on 4 days', 4, count(date => { const kcal = data.calories?.get(date) ?? 0; return kcal > 0 && kcal <= target; }), 150, `Your plan: ${target.toLocaleString('en-US')} kcal a day`));
  } else if (/endurance/i.test(goal)) {
    const longest = week.reduce((s, date) => { const run = data.workouts.has(date) ? s.run + 1 : 0; return { run, best: Math.max(s.best, run) }; }, { run: 0, best: 0 }).best;
    quests.push(quest('back-to-back', 'Train on 2 days in a row', 2, longest, 150, 'Back-to-back sessions build endurance'));
  } else {
    quests.push(quest('active', 'Stay active on 5 days', 5, count(date => data.active.has(date)), 150, /weight loss/i.test(goal) ? 'Save a dietary plan to get a calorie quest instead' : 'Steady movement is the heart of general fitness'));
  }

  // 3. The journey: a weekly weigh-in toward the target weight.
  if (/weight loss|muscle/i.test(goal) || Number.isFinite(targetWeight)) {
    quests.push(quest('weigh-in', 'Log a weigh-in this week', 1, count(date => data.weighIns?.has(date) ?? false), 100,
      Number.isFinite(targetWeight) ? `Track the way to ${targetWeight} ${unit}` : 'See your progress over time'));
  }

  // 4. The body: age 35+ or a consented health risk earns rest instead of more load.
  if (ageBand(profile.age) !== 'under35' || health.length) {
    quests.push(quest('recovery', 'Take 2 full rest days this week', 2, count(date => date < until && !data.workouts.has(date)), 100,
      health.length ? 'Because of your health profile' : 'Recovery matters more from age 35'));
  }
  return quests;
}

/** The same three challenges for everyone; each target is one more than last week's result, within safe bounds. */
export function weeklyChallenges(data: DayData, start: string, until: string): Quest[] {
  const lastWeek = weekDays(shiftDate(start, -7), shiftDate(start, -1));
  const week = weekDays(start, until);
  const rules: [string, (target: number) => string, (date: string) => boolean, number, number, number][] = [
    ['train', target => `Train on ${days(target)}`, date => data.workouts.has(date), 2, 5, 200],
    ['hydrate', target => `Drink 8 glasses of water on ${days(target)}`, date => (data.water.get(date) ?? 0) >= 8, 3, 7, 150],
    ['meals', target => `Complete the meal mission on ${days(target)}`, data.mealsDone, 3, 7, 150],
  ];
  return rules.map(([key, title, done, min, max, points]) => {
    const target = clamp(lastWeek.filter(done).length + 1, min, max);
    const last = lastWeek.filter(done).length;
    return quest(key, title(target), target, week.filter(done).length, points, last ? `Last week: ${days(last)}` : 'Starting target');
  });
}

/**
 * XP from every completed personal quest and weekly challenge since the first recorded activity,
 * plus how many weeks each set was fully completed (used by the quest badges).
 */
export function questHistory(profile: QuestProfile | null, data: DayData, today: string) {
  const history = { exp: 0, personalWeeks: 0, planWeeks: 0, challengeWeeks: 0 };
  const first = [...data.active, ...data.records].sort()[0];
  if (!first || first > today) return history;
  // shortcut: past weeks are scored with today's profile, so changing goal or plan can shift old quest XP; store awards if that matters.
  for (let start = weekStart(first); start <= today; start = shiftDate(start, 7)) {
    const until = start === weekStart(today) ? today : shiftDate(start, 6);
    const personal = personalQuests(profile, data, start, until), challenges = weeklyChallenges(data, start, until);
    for (const item of [...personal, ...challenges]) if (item.complete) history.exp += item.points;
    if (personal.length && personal.every(item => item.complete)) history.personalWeeks++;
    if (personal.some(item => item.key === 'plan' && item.complete)) history.planWeeks++;
    if (challenges.every(item => item.complete)) history.challengeWeeks++;
  }
  return history;
}

export const questExp = (profile: QuestProfile | null, data: DayData, today: string) => questHistory(profile, data, today).exp;
