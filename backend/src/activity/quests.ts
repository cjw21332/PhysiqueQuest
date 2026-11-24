import { ageBand } from '../coach/coach-planner.js';

/** Per-day evidence already loaded for daily missions, keyed by YYYY-MM-DD in the user's timezone. */
export type DayData = {
  workouts: Set<string>;
  records: Set<string>;
  active: Set<string>;
  water: Map<string, number>;
  protein: Map<string, number>;
  mealsDone: (date: string) => boolean;
};
export type QuestProfile = { age?: string; weight?: string; weightUnit?: string; goal?: string; days?: string[]; injuries?: string[]; healthRisks?: string[]; conditions?: string[]; healthConsentAt?: Date };
export type Quest = { key: string; title: string; target: number; progress: number; points: number; complete: boolean };

export const shiftDate = (date: string, days: number) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10); };
/** Weeks start on Monday. */
export const weekStart = (date: string) => shiftDate(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
const weekDays = (start: string, until: string) => Array.from({ length: 7 }, (_, index) => shiftDate(start, index)).filter(date => date <= until);
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const quest = (key: string, title: string, target: number, progress: number, points: number): Quest =>
  ({ key, title, target, points, progress: Math.min(progress, target), complete: progress >= target });
const days = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`;

/** Quests built from the user's own profile: training plan, goal, body weight, age and consented health data. */
export function personalQuests(profile: QuestProfile | null, data: DayData, start: string, until: string): Quest[] {
  if (!profile) return [];
  const week = weekDays(start, until);
  const count = (test: (date: string) => boolean) => week.filter(test).length;
  // Health data counts only with consent, as in Coach.
  const health = profile.healthConsentAt ? [...(profile.injuries ?? []), ...(profile.healthRisks ?? []), ...(profile.conditions ?? [])] : [];
  const planned = clamp(profile.days?.length || 3, 1, 7);
  const quests = [quest('plan', `Train on ${days(planned)} this week, as planned`, planned, count(date => data.workouts.has(date)), 200)];

  const kg = Number.parseFloat(profile.weight ?? '') * (profile.weightUnit === 'lbs' ? 0.45359237 : 1);
  const goal = profile.goal ?? '';
  // 1.6 g/kg is the usual muscle-gain target; skipped for minors and anyone with a health condition on file.
  if (/muscle|strength/i.test(goal) && Number(profile.age) >= 18 && !health.length && kg >= 30 && kg <= 300) {
    const grams = Math.round(kg * 1.6 / 5) * 5;
    quests.push(quest('protein', `Reach ${grams} g of protein on 4 days`, 4, count(date => (data.protein.get(date) ?? 0) >= grams), 150));
  } else if (/weight loss/i.test(goal)) {
    quests.push(quest('hydration', 'Drink 8 glasses of water on 5 days', 5, count(date => (data.water.get(date) ?? 0) >= 8), 150));
  } else {
    const target = /endurance/i.test(goal) ? 6 : 5;
    quests.push(quest('active', `Stay active on ${target} days`, target, count(date => data.active.has(date)), 150));
  }

  // Age 35+ or a health risk: reward recovery instead of chasing a maximal lift.
  if (ageBand(profile.age) !== 'under35' || health.length) quests.push(quest('recovery', 'Take 2 full rest days this week', 2, count(date => date < until && !data.workouts.has(date)), 100));
  else quests.push(quest('record', 'Set a personal record this week', 1, count(date => data.records.has(date)), 150));
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
    return quest(key, title(target), target, week.filter(done).length, points);
  });
}

/** XP from every completed personal quest and weekly challenge since the first recorded activity. */
export function questExp(profile: QuestProfile | null, data: DayData, today: string) {
  const first = [...data.active, ...data.records].sort()[0];
  if (!first || first > today) return 0;
  let exp = 0;
  // shortcut: past weeks are scored with today's profile, so changing goal or plan can shift old quest XP; store awards if that matters.
  for (let start = weekStart(first); start <= today; start = shiftDate(start, 7)) {
    const until = start === weekStart(today) ? today : shiftDate(start, 6);
    for (const item of [...personalQuests(profile, data, start, until), ...weeklyChallenges(data, start, until)]) if (item.complete) exp += item.points;
  }
  return exp;
}
