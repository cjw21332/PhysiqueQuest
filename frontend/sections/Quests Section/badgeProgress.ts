import type { ActivityBadge, ActivityState } from '../../hooks/useActivity';
import type { LeaderboardRecord, WorkoutSessionRecord, WorkoutSummary } from '../../lib/api';

type ProfileWeight = { weight: string; weightUnit: string };
type Nutrition = { water: { date: string; glasses: number }[]; meals: { id?: string; date?: string; scanSavedAt?: string; scanGroupId?: string }[]; scanSaveReceipts?: { key: string; mealIds: string[] }[] };
type Inputs = { activity: ActivityState; saved: ActivityBadge[]; ranking: LeaderboardRecord | null; workouts: WorkoutSessionRecord[] | null; summary: WorkoutSummary | null; nutrition: Nutrition | null; profile: ProfileWeight };

const longestRun = (dates: string[]) => [...new Set(dates)].sort().reduce((s, date) => {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(time)) return s;
  const run = time - s.previous === 86400000 ? s.run + 1 : 1;
  return { previous: time, run, longest: Math.max(run, s.longest) };
}, { previous: 0, run: 0, longest: 0 }).longest;

export const badgeGroups = [
  { name: 'Activity streaks', ids: [1, 3, 7, 10, 14, 30, 60, 100].map(n => `streak-${n}`) },
  { name: 'Workout milestones', ids: ['first-workout', ...[5, 10, 25, 50, 100].map(n => `workouts-${n}`), 'early-bird'] },
  { name: 'Strength and records', ids: ['personal-record', ...[50, 100, 150].map(n => `lift-${n}`), 'best-form'] },
  { name: 'Daily mission streaks', ids: [1, 3, 7, 14, 30].map(n => `goal-${n}`) },
  { name: 'Hydration', ids: [1, 3, 7, 20, 50, 100].map(n => `hydration-${n}`) },
  { name: 'Nutrition', ids: ['macro-master'] },
  { name: 'Estimated calories burned', ids: [100, 1000, 10000, 100000].map(n => `calories-${n}`) },
  { name: 'Experience', ids: ['level-beginner', 'level-amateur', 'level-pro', 'level-veteran'] },
  { name: 'All-time leaderboard', ids: ['top-100', 'top-50', 'top-10', 'top-1'] },
];

export function buildBadgeCollection({ activity, saved, ranking, workouts, summary, nutrition, profile }: Inputs): ActivityBadge[] {
  const previous = (id: string) => saved.find(b => b.id === id);
  const milestone = (id: string, title: string, icon: string, current: number | null, target: number, unit: string, description: string): ActivityBadge => ({
    id, title, icon, earned: current !== null && current >= target, available: current !== null,
    description: current === null ? `${description} Progress is temporarily unavailable.` : description,
    ...(current !== null ? { progress: { current, target, unit } } : {}),
  });
  const longest = activity.activityDates ? longestRun(activity.activityDates) : null;
  const validWorkouts = workouts?.filter(w => w.status === 'completed' && !!w.endedAt && w.origin !== 'recorded-set' && (!w.sets?.length || w.sets.some(s => s.status === 'completed'))) ?? null;
  const maxLift = summary ? Math.max(0, ...summary.personalRecords.map(r => r.loadKg ?? 0)) : null;
  const weight = Number(profile.weight) * (/lb/i.test(profile.weightUnit) ? 0.45359237 : 1);
  // 3.5 MET: 2024 Adult Compendium, multiple-exercise resistance training.
  const calories = validWorkouts && weight > 0 ? Math.round(validWorkouts.reduce((sum, w) => sum + (Number.isFinite(w.durationSeconds) && (w.durationSeconds ?? 0) > 0 ? w.durationSeconds! : 0), 0) / 3600 * weight * 3.5) : null;
  const water = nutrition?.water;
  const days = water ? new Set(water.filter(w => w.glasses >= 8).map(w => w.date)).size : null;
  let goalStreak: number | null = null;
  if (nutrition && workouts && summary) {
    const groups = new Map<string, string>();
    for (const receipt of nutrition.scanSaveReceipts ?? []) for (const id of receipt.mealIds ?? []) groups.set(String(id), receipt.key);
    const meals = new Map<string, string>();
    for (const meal of nutrition.meals ?? []) {
      if (!meal.date || !meal.scanSavedAt) continue;
      const timestamp = Date.parse(meal.scanSavedAt);
      const group = meal.scanGroupId || (meal.id && groups.get(String(meal.id))) || (Number.isFinite(timestamp) ? `legacy:${timestamp}` : undefined);
      if (group) meals.set(group, meal.date);
    }
    const counts = new Map<string, number>();
    for (const date of meals.values()) counts.set(date, (counts.get(date) ?? 0) + 1);
    const best = new Map<string, number>();
    const recordDays = new Set<string>();
    const dateInZone = (date: string, timezone: string) => {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(date));
      return ['year', 'month', 'day'].map(part => parts.find(p => p.type === part)?.value ?? '').join('-');
    };
    for (const session of [...workouts].filter(w => w.status === 'completed' && w.endedAt).sort((a, b) => Date.parse(a.endedAt!) - Date.parse(b.endedAt!))) {
      const sessionBest = new Map<string, number>();
      for (const set of session.sets ?? []) if (set.status === 'completed' && set.exerciseId && Number.isFinite(set.loadKg) && (set.loadKg ?? 0) > 0 && Number.isInteger(set.reps) && set.reps > 0) sessionBest.set(set.exerciseId, Math.max(sessionBest.get(set.exerciseId) ?? 0, set.loadKg!));
      for (const [exercise, load] of sessionBest) {
        const previous = best.get(exercise);
        if (previous !== undefined && load > previous) recordDays.add(dateInZone(session.endedAt!, session.timezone || activity.timezone || 'UTC'));
        best.set(exercise, Math.max(previous ?? 0, load));
      }
    }
    const waterDays = new Set((water ?? []).filter(w => w.glasses >= 8).map(w => w.date));
    goalStreak = longestRun(summary.trainingDates.filter(date => (counts.get(date) ?? 0) >= 3 && waterDays.has(date) && recordDays.has(date)));
  }
  const result: ActivityBadge[] = [];
  for (const n of [1, 3, 7, 10, 14, 30, 60, 100]) result.push(milestone(`streak-${n}`, `${n}-day streak`, 'fire', longest, n, 'days', `Record activity on ${n} consecutive days. Your best streak counts.`));
  for (const n of [1, 5, 10, 25, 50, 100]) result.push(milestone(n === 1 ? 'first-workout' : `workouts-${n}`, n === 1 ? 'First workout' : `${n} workouts completed`, 'dumbbell', validWorkouts?.length ?? null, n, 'workouts', `Complete ${n} ${n === 1 ? 'workout' : 'workouts'}.`));
  result.push(previous('early-bird') ?? { id: 'early-bird', title: 'Early bird', icon: 'sun', earned: false, available: false, description: 'Workout timing is unavailable.' });
  const pr = previous('personal-record') ?? previous('first-pr');
  result.push(pr ? { ...pr, id: 'personal-record', title: 'New Personal Record' } : { id: 'personal-record', title: 'New Personal Record', icon: 'trophy', earned: false, available: false, description: 'Personal record progress is unavailable.' });
  for (const n of [50, 100, 150]) result.push(milestone(`lift-${n}`, `${n}kg Dominator`, 'dumbbell', maxLift, n, 'kg', `Complete a logged set with at least ${n} kg. Loads are self-reported.`));
  result.push({ id: 'best-form', title: 'Best Form', icon: 'medal', earned: false, available: false, description: 'Form scoring is not available yet.' });
  for (const n of [1, 3, 7, 14, 30]) result.push(milestone(`goal-${n}`, `${n}-day mission streak`, 'target', goalStreak, n, 'consecutive days', `Complete all daily missions on ${n} consecutive ${n === 1 ? 'day' : 'days'}.`));
  for (const n of [1, 3, 7, 20, 50, 100]) result.push(milestone(`hydration-${n}`, n === 1 ? 'First hydration goal' : `${n} hydration goals`, 'water', days, n, 'days', `Reach 8 glasses of water on ${n} separate ${n === 1 ? 'day' : 'days'}.`));
  result.push(previous('macro-master') ?? { id: 'macro-master', title: 'Macro master', icon: 'target', earned: false, available: false, description: 'Nutrition progress is temporarily unavailable.' });
  for (const n of [100, 1000, 10000, 100000]) result.push(milestone(`calories-${n}`, `${n.toLocaleString('en-US')} estimated calories`, 'fire', calories, n, 'estimated kcal', `Estimated using completed workout duration and your current saved weight (3.5 MET). Add your weight to see progress.`));
  for (const [id, title, target] of [['level-beginner', 'Beginner', 1], ['level-amateur', 'Amateur', 5], ['level-pro', 'Pro', 15], ['level-veteran', 'Veteran', 30]] as const) result.push(milestone(id, title, 'medal', activity.level, target, 'levels', `Reach level ${target}.`));
  for (const n of [100, 50, 10, 1]) {
    const rank = ranking && ranking.self.points > 0 ? ranking.self.rank : null;
    result.push({ id: `top-${n}`, title: n === 1 ? 'Number 1 Overall' : `Top ${n} Overall`, icon: 'crown', earned: rank !== null && rank <= n, available: ranking !== null, description: 'Based on your current all-time quest points rank; rankings can change.', progressText: rank === null ? 'Earn quest points to enter the rankings.' : `Current all-time rank: #${rank}` });
  }
  return result;
}
