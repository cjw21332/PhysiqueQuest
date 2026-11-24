import type { ActivityBadge, ActivityState } from '../../hooks/useActivity';
import type { LeaderboardRecord, WorkoutSessionRecord, WorkoutSummary } from '../../lib/api';

type ProfileWeight = { weight: string; weightUnit: string; goal?: string; targetWeight?: string };
type Nutrition = { water: { date: string; glasses: number }[]; meals: { id?: string; date?: string; scanSavedAt?: string; scanGroupId?: string }[]; scanSaveReceipts?: { key: string; mealIds: string[] }[] };
type Inputs = { activity: ActivityState; saved: ActivityBadge[]; ranking: LeaderboardRecord | null; workouts: WorkoutSessionRecord[] | null; summary: WorkoutSummary | null; nutrition: Nutrition | null; profile: ProfileWeight };

const longestRun = (dates: string[]) => [...new Set(dates)].sort().reduce((s, date) => {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(time)) return s;
  const run = time - s.previous === 86400000 ? s.run + 1 : 1;
  return { previous: time, run, longest: Math.max(run, s.longest) };
}, { previous: 0, run: 0, longest: 0 }).longest;

const DAY_MS = 86400000;
const dayOf = (date: string) => Date.parse(`${date}T00:00:00Z`);
const weekday = (date: string) => new Date(dayOf(date)).getUTCDay();
const localDate = (iso: string, timezone: string) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso)); return ['year', 'month', 'day'].map(part => p.find(x => x.type === part)?.value ?? '').join('-'); };
const localHour = (iso: string, timezone: string) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso)));

export function buildBadgeCollection({ activity, saved, ranking, workouts, summary, nutrition, profile }: Inputs): ActivityBadge[] {
  const previous = (id: string) => saved.find(b => b.id === id);
  const milestone = (id: string, title: string, icon: string, current: number | null, target: number, unit: string, description: string): ActivityBadge => ({
    id, title, icon, earned: current !== null && current >= target, available: current !== null,
    description: current === null ? `${description} Progress is temporarily unavailable.` : description,
    ...(current !== null ? { progress: { current, target, unit } } : {}),
  });
  const flag = (id: string, title: string, icon: string, done: boolean | null, description: string): ActivityBadge => ({ id, title, icon, earned: done === true, available: done !== null, description: done === null ? `${description} Progress is temporarily unavailable.` : description, ...(done !== null ? { progress: { current: Number(done), target: 1, unit: 'time' } } : {}) });
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
  for (const n of [1, 3, 7, 14, 30]) result.push(milestone(`goal-${n}`, `${n}-day mission streak`, 'target', goalStreak, n, 'consecutive days', `Complete all daily missions on ${n} consecutive ${n === 1 ? 'day' : 'days'}.`));
  for (const n of [1, 3, 7, 20, 50, 100]) result.push(milestone(`hydration-${n}`, n === 1 ? 'First hydration goal' : `${n} hydration goals`, 'water', days, n, 'days', `Reach 8 glasses of water on ${n} separate ${n === 1 ? 'day' : 'days'}.`));
  result.push(previous('macro-master') ?? { id: 'macro-master', title: 'Macro master', icon: 'target', earned: false, available: false, description: 'Nutrition progress is temporarily unavailable.' });
  for (const n of [100, 1000, 10000, 100000]) result.push(milestone(`calories-${n}`, `${n.toLocaleString('en-US')} estimated calories`, 'fire', calories, n, 'estimated kcal', `Estimated using completed workout duration and your current saved weight (3.5 MET). Add your weight to see progress.`));
  for (const [id, title, target] of [['level-beginner', 'Beginner', 1], ['level-amateur', 'Amateur', 5], ['level-pro', 'Pro', 15], ['level-veteran', 'Veteran', 30]] as const) result.push(milestone(id, title, 'medal', activity.level, target, 'levels', `Reach level ${target}.`));
  for (const n of [100, 50, 10, 1]) {
    const rank = ranking && ranking.self.points > 0 ? ranking.self.rank : null;
    result.push({ id: `top-${n}`, title: n === 1 ? 'Number 1 Overall' : `Top ${n} Overall`, icon: 'crown', earned: rank !== null && rank <= n, available: ranking !== null, description: 'Based on your current all-time quest points rank; rankings can change.', progressText: rank === null ? 'Earn quest points to enter the rankings.' : `Current all-time rank: #${rank}` });
  }
  // ===== New badges (Nov 2026): all derived from data the app already loads. =====
  const tz = activity.timezone || 'UTC';
  const workoutDays = validWorkouts ? [...new Set(validWorkouts.map(w => localDate(w.endedAt!, w.timezone || tz)))].sort() : null;
  const dates = activity.activityDates ? new Set(activity.activityDates) : null;
  const fullWeek = dates ? [...dates].some(date => weekday(date) === 1 && Array.from({ length: 7 }, (_, i) => new Date(dayOf(date) + i * DAY_MS).toISOString().slice(0, 10)).every(day => dates.has(day))) : null;
  result.push(flag('seven-suns', 'Seven Suns', 'sun', fullWeek, 'Record activity on all seven days of one week, Monday to Sunday.'));
  const weekend = workoutDays ? workoutDays.some(day => weekday(day) === 6 && workoutDays.includes(new Date(dayOf(day) + DAY_MS).toISOString().slice(0, 10))) : null;
  result.push(flag('weekend-vanguard', 'Weekend Vanguard', 'calendar', weekend, 'Train on both Saturday and Sunday of the same weekend.'));
  const night = validWorkouts ? validWorkouts.some(w => { const hour = localHour(w.endedAt!, w.timezone || tz); return hour >= 20 && hour <= 23; }) : null;
  result.push(flag('night-owl', 'Moonlit Iron', 'star', night, 'Finish a workout between 8 PM and midnight.'));
  const comeback = workoutDays ? workoutDays.some((day, i) => i > 0 && dayOf(day) - dayOf(workoutDays[i - 1]) >= 14 * DAY_MS) : null;
  result.push(flag('phoenix', 'Phoenix Return', 'trend', comeback, 'Come back and train after a break of two weeks or more. Coach eases your loads for you.'));
  const sets = validWorkouts?.flatMap(w => (w.sets ?? []).filter(set => set.status === 'completed')) ?? null;
  const exercises = sets ? new Set(sets.map(set => set.exerciseId).filter(Boolean)).size : null;
  result.push(milestone('variety-10', 'Movement Cartographer', 'exercise-books', exercises, 10, 'exercises', 'Complete sets of 10 different exercises.'));
  result.push(milestone('variety-25', 'Atlas of Motion', 'exercise-books', exercises, 25, 'exercises', 'Complete sets of 25 different exercises.'));
  const volume = sets ? Math.round(sets.reduce((sum, set) => sum + (Number.isFinite(set.loadKg) && (set.loadKg ?? 0) > 0 && set.reps > 0 ? set.loadKg! * set.reps : 0), 0)) : null;
  for (const n of [10000, 50000, 250000]) result.push(milestone(`volume-${n}`, `Iron Ledger · ${n / 1000}k kg`, 'chart-bars', volume, n, 'kg moved', `Move ${n.toLocaleString('en-US')} kg in total (load × reps of completed sets). Loads are self-reported.`));
  const weeks = activity.questWeeks;
  for (const [n, title] of [[1, 'Gauntlet Runner'], [4, 'Gauntlet Marshal'], [12, 'Gauntlet Legend']] as const) result.push(milestone(`gauntlet-${n}`, title, 'shield', weeks?.challenges ?? null, n, n === 1 ? 'week' : 'weeks', `Finish every weekly challenge in ${n} ${n === 1 ? 'week' : 'separate weeks'}.`));
  for (const [n, title] of [[1, 'Oath Sworn'], [4, 'Oathkeeper'], [12, 'Unbroken Oath']] as const) result.push(milestone(`oath-${n}`, title, 'calendar', weeks?.plan ?? null, n, n === 1 ? 'week' : 'weeks', `Train on every day you planned, for ${n} ${n === 1 ? 'week' : 'weeks'}. Your plan, your oath.`));
  for (const [n, title] of [[1, 'Self-Made'], [4, 'Architect of Self'], [12, 'Legend of One']] as const) result.push(milestone(`self-made-${n}`, title, 'user', weeks?.personal ?? null, n, n === 1 ? 'week' : 'weeks', `Complete every personal quest in ${n} ${n === 1 ? 'week' : 'separate weeks'}.`));
  const target = Number.parseFloat(profile.targetWeight ?? ''), current = Number.parseFloat(profile.weight);
  const losing = /weight loss/i.test(profile.goal ?? ''), gaining = /muscle/i.test(profile.goal ?? '');
  const summitKnown = Number.isFinite(target) && Number.isFinite(current) && (losing || gaining);
  result.push({ id: 'summit', title: 'Summit of You', icon: 'scale', earned: summitKnown && (losing ? current <= target : current >= target), available: summitKnown,
    description: summitKnown ? `Reach your own target weight of ${target} ${profile.weightUnit || 'kg'}.` : 'Set a weight-loss or muscle goal with a target weight to unlock this summit.',
    ...(summitKnown ? { progressText: `Now ${current} ${profile.weightUnit || 'kg'} · target ${target}` } : {}) });
  return result;
}
