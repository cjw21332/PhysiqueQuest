import { scheduledWeekdays } from '../coach/coach-planner.js';
import { fitnessTier, type BodyIndexProfile, type FitnessTier } from '../profile/body-index.js';

/** Per-day evidence keyed by YYYY-MM-DD in the user's timezone. */
export type DayData = {
  workouts: Set<string>;
  records: Set<string>;
  active: Set<string>;
  water: Map<string, number>;
  mealsDone: (date: string) => boolean;
};
export type QuestProfile = { days?: string[] } & BodyIndexProfile;
export type Quest = { key: string; title: string; target: number; progress: number; points: number; complete: boolean; reason?: string };

export const shiftDate = (date: string, days: number) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10); };
/** Weeks start on Monday. */
export const weekStart = (date: string) => shiftDate(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
const weekDays = (start: string, until: string) => Array.from({ length: 7 }, (_, index) => shiftDate(start, index)).filter(date => date <= until);
const weekdayIndex = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const days = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`;

/** True when every weekday the user planned in this week had a workout (feeds the Oathkeeper badge). */
export function planKept(profile: QuestProfile | null, data: DayData, start: string, until: string) {
  const planned = profile?.days?.length ? scheduledWeekdays(profile.days) : new Set<number>();
  if (!planned.size) return false;
  const week = Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
  return week.filter(date => planned.has(weekdayIndex(date))).every(date => date <= until && data.workouts.has(date));
}

/** [min, max] weekly targets per fitness tier (from activity level and BMI) for training, water and meals. */
const TIER_BOUNDS: Record<FitnessTier, Record<'train' | 'hydrate' | 'meals', [number, number]>> = {
  starter: { train: [1, 3], hydrate: [3, 7], meals: [2, 5] },
  building: { train: [2, 5], hydrate: [3, 7], meals: [3, 7] },
  advanced: { train: [3, 6], hydrate: [4, 7], meals: [4, 7] },
};

/** Three challenges whose bounds follow the user's fitness tier; each target is one more than last week's result. */
export function weeklyChallenges(data: DayData, start: string, until: string, tier: FitnessTier = 'building'): Quest[] {
  const lastWeek = weekDays(shiftDate(start, -7), shiftDate(start, -1));
  const week = weekDays(start, until);
  const bounds = TIER_BOUNDS[tier];
  const rules: [keyof typeof bounds, (target: number) => string, (date: string) => boolean, number][] = [
    ['train', target => tier === 'starter' ? `Move for 20+ minutes on ${days(target)}` : `Train on ${days(target)}`, date => data.workouts.has(date), 200],
    ['hydrate', target => `Drink 8 glasses of water on ${days(target)}`, date => (data.water.get(date) ?? 0) >= 8, 150],
    ['meals', target => `Complete the meal mission on ${days(target)}`, data.mealsDone, 150],
  ];
  return rules.map(([key, title, done, points]) => {
    const [min, max] = bounds[key];
    const last = lastWeek.filter(done).length;
    const target = clamp(last + 1, min, max), progress = week.filter(done).length;
    return { key, title: title(target), target, points, progress: Math.min(progress, target), complete: progress >= target, reason: last ? `Last week: ${days(last)}` : `Starting target for your ${tier} level` };
  });
}

/** XP from completed weekly challenges, plus how many weeks the plan was kept and every challenge was done. */
export function questHistory(profile: QuestProfile | null, data: DayData, today: string) {
  const history = { exp: 0, planWeeks: 0, challengeWeeks: 0 };
  const first = [...data.active, ...data.records].sort()[0];
  if (!first || first > today) return history;
  // shortcut: past weeks use today's training days, so editing the plan can shift Oathkeeper counts; store weekly results if that matters.
  for (let start = weekStart(first); start <= today; start = shiftDate(start, 7)) {
    const until = start === weekStart(today) ? today : shiftDate(start, 6);
    const challenges = weeklyChallenges(data, start, until, fitnessTier(profile));
    for (const item of challenges) if (item.complete) history.exp += item.points;
    if (planKept(profile, data, start, until)) history.planWeeks++;
    if (challenges.every(item => item.complete)) history.challengeWeeks++;
  }
  return history;
}

export const questExp = (profile: QuestProfile | null, data: DayData, today: string) => questHistory(profile, data, today).exp;
