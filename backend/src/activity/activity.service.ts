import { mealMissionGoal, mealMissionPoints } from './meal-mission.js';
import { savedScanMealDates } from '../nutrition/saved-scan-meals.js';
import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { Profile } from '../profile/schemas/profile.schema.js';
import { FeedbackService } from '../feedback/feedback.service.js';
import { ageBand, scheduledWeekdays } from '../coach/coach-planner.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NutritionService } from '../nutrition/nutrition.service.js';
import { WorkoutsService } from '../workouts/workouts.service.js';
import { UpdateActivityDto } from './dto/activity.dto.js';
import { Activity } from './schemas/activity.schema.js';
import { activityDate, earnsWorkoutCredit } from '../workouts/workout-contract.js';
import { LeaderboardService } from '../leaderboard/leaderboard.service.js';
import { User } from '../auth/schemas/user.schema.js';
import { AccountLifecycleFence } from '../privacy/account-lifecycle-fence.js';

const missionRules = [
  { key: 'workout', title: 'Complete one workout', target: 1, points: 100 },
  { key: 'meals', title: 'Log 3 meals', target: 3, points: 60 },
  { key: 'water', title: 'Drink 8 glasses of water', target: 8, points: 40 },
  { key: 'personal-record', title: 'Beat one personal record', target: 1, points: 150 },
] as const;
const zoneDate = (date: Date, timezone: string) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(Activity.name) private readonly model: Model<Activity>,
    private readonly nutrition: NutritionService,
    private readonly workouts: WorkoutsService,
    private readonly leaderboard: LeaderboardService,
    @InjectModel(User.name) private readonly users: Model<User>,
    // Optional so missions still load (with the default set) where profile or feedback is not wired.
    @Optional() @InjectModel(Profile.name) private readonly profiles?: Model<Profile>,
    @Optional() private readonly feedback?: FeedbackService,
  ) {}

  private async userState(userId: string) {
    return new AccountLifecycleFence(this.model.db).withActiveWrite(userId, async session => this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), state: { timezone: 'UTC' } } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session },
    ));
  }

  async get(userId: string, requestedTimezone?: string) {
    return this.summary(userId, requestedTimezone, true);
  }

  /** Own records only, with no leaderboard reads or snapshot writes. */
  async getForAssistant(userId: string) {
    return this.summary(userId, undefined, false);
  }

  private async summary(userId: string, requestedTimezone: string | undefined, includeLeaderboard: boolean) {
    const record = await this.model.findOne({ userId: new Types.ObjectId(userId) }).exec();
    const timezone = resolveTimezone(requestedTimezone ?? record?.state?.timezone);
    const [nutrition, workouts, records, ranking, user, liftSummary] = await Promise.all([this.nutrition.read(userId, 'userId meals.id meals.date meals.scanSavedAt meals.scanGroupId meals.protein meals.carbs meals.fat scanSaveReceipts.key scanSaveReceipts.mealIds water.date water.glasses'), this.workouts.creditHistory(userId, timezone), this.workouts.personalRecordDays(userId, timezone), includeLeaderboard ? this.leaderboard.get(userId, 'all').catch(() => null) : Promise.resolve(null), this.users.findById(userId).select('createdAt').lean().exec(), typeof this.workouts.summary === 'function' ? this.workouts.summary(userId, timezone).catch(() => null) : Promise.resolve(null)]);
    const today = zoneDate(new Date(), timezone);

    const mealDates = nutrition.meals.map(meal => meal.date).filter((date): date is string => typeof date === 'string');
    const savedMealDates = savedScanMealDates(nutrition.meals, 'scanSaveReceipts' in nutrition ? nutrition.scanSaveReceipts : undefined);
    const waterByDate = new Map(nutrition.water.map(entry => [entry.date, entry.glasses]));
    const completedWorkouts = workouts.filter(workout => earnsWorkoutCredit(workout) && workout.endedAt);

    const todayStats = computeTodayStats(savedMealDates, completedWorkouts, waterByDate, today, timezone);


    const allMeals = buildMealCountMap(savedMealDates);
    const mealGoal = mealMissionGoal(today, allMeals);
    const allWorkoutDates = new Set(completedWorkouts.map(workout => workout.activityDate || activityDate(workout.endedAt!, timezone)));
    const [profile, feedback] = await Promise.all([
      this.profiles ? this.profiles.findOne({ userId: new Types.ObjectId(userId) }).select('age injuries healthRisks healthConsentAt days').lean().exec().catch(() => null) : null,
      this.feedback ? this.feedback.list(userId, 20).catch(() => []) : [],
    ]);
    const feedbackToday = (feedback as { createdAt?: Date }[]).filter(row => row.createdAt && zoneDate(new Date(row.createdAt), timezone) === today).length;
    const dailyMissions = buildDailyMissions({ ...todayStats, records: Number(records.includes(today)), feedback: feedbackToday }, mealGoal,
      missionContext(profile as MissionProfile | null, today, allWorkoutDates, Boolean(this.feedback)));
    const activityDates = buildActivityDates(mealDates, nutrition.water, allWorkoutDates);

    const dayStreak = computeStreak(activityDates, today);
    const currentExp = computeExp(allMeals, allWorkoutDates, waterByDate) + records.length * 150;
    const earnedPoints = dailyMissions.filter(m => m.complete).reduce((sum, m) => sum + m.points, 0);
    const goalDays = new Set([...allWorkoutDates].filter(date => (allMeals.get(date) ?? 0) >= mealMissionGoal(date, allMeals) && (waterByDate.get(date) ?? 0) >= 8 && records.includes(date)));
    const level = Math.floor(currentExp / 100) + 1;
    const maxLift = liftSummary ? liftSummary.personalRecords.reduce((max: number, record: { loadKg?: number }) => Number.isFinite(record.loadKg) ? Math.max(max, record.loadKg!) : max, 0) : null;
    const badges = buildBadges(completedWorkouts, nutrition.meals, waterByDate, activityDates, records, ranking?.self.points ? ranking.self.rank : null, ranking !== null, { level, goalDays, maxLift });

    return {
      state: {
        timezone,
        questProgress: {
          workout: Math.min(todayStats.workouts, 1),
          meals: Math.min(todayStats.meals, mealGoal),
          water: Math.min(todayStats.water, 8),
        },
        level: Math.floor(currentExp / 100) + 1,
        currentExp: currentExp % 100,
        nextLevelExp: 100,
        dayStreak,
        activityDates: [...activityDates].sort(),
        accountCreatedAt: user?.createdAt ?? null,
        earnedPoints,
      },
      dailyMissions,
      badges,
    };
  }

  // update() is intentionally kept separate — it validates and persists, then delegates to get().
  async update(userId: string, dto: UpdateActivityDto) {
    const timezone = dto.state.timezone;
    if (timezone) {
      try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
      catch { throw new BadRequestException('Timezone is not supported'); }
    }
    const current = await this.userState(userId);
    current.state = { timezone: timezone ?? current.state.timezone ?? 'UTC' };
    await new AccountLifecycleFence(this.model.db).withActiveWrite(userId, async session => current.save({ session }));
    return this.get(userId);
  }
}

function resolveTimezone(requested?: unknown): string {
  let timezone = typeof requested === 'string' ? requested : 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
  catch { timezone = 'UTC'; }
  return timezone;
}

function computeTodayStats(savedMealDates: string[], completedWorkouts: any[], waterByDate: Map<string, number>, today: string, timezone: string) {
  return {
    meals: savedMealDates.filter(date => date === today).length,
    water: waterByDate.get(today) ?? 0,
    workouts: completedWorkouts.filter(w => (w.activityDate || activityDate(w.endedAt!, w.timezone ?? timezone)) === today).length,
  };
}

type MissionProfile = { age?: string; injuries?: string[]; healthRisks?: string[]; healthConsentAt?: Date; days?: string[] };
type MissionContext = { cautious: boolean; restDay: boolean; comeback: boolean };

const shiftDate = (date: string, days: number) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10); };

/** Reads the user's data that changes which missions they get today. */
export function missionContext(profile: MissionProfile | null, today: string, workoutDates: Set<string>, feedbackAvailable: boolean): MissionContext {
  // Injuries and health risks count only with health-data consent, as in Coach.
  const health = profile?.healthConsentAt ? [...(profile.injuries ?? []), ...(profile.healthRisks ?? [])] : [];
  const cautious = feedbackAvailable && !!profile && (ageBand(profile.age) !== 'under35' || health.length > 0);
  // scheduledWeekdays falls back to default days for an empty list, so only trust days the user chose.
  const scheduled = profile?.days?.length ? scheduledWeekdays(profile.days) : new Set<number>();
  const restDay = scheduled.size > 0 && !scheduled.has((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7);
  // A comeback needs earlier training history; a brand-new user keeps the default workout mission.
  const weekAgo = shiftDate(today, -7);
  const comeback = !restDay && [...workoutDates].some(date => date < weekAgo) && ![...workoutDates].some(date => date >= weekAgo && date < today);
  return { cautious, restDay, comeback };
}

export function buildDailyMissions(todayStats: { meals: number, water: number, workouts: number, records: number, feedback?: number }, mealGoal: number, context: MissionContext = { cautious: false, restDay: false, comeback: false }) {
  return missionRules.map(rule => {
    const progress = rule.key === 'workout' ? todayStats.workouts :
                     rule.key === 'meals' ? todayStats.meals :
                     rule.key === 'water' ? todayStats.water : todayStats.records;
    if (rule.key === 'meals' && mealGoal === 2) return { ...rule, title: 'Build on yesterday: log 2 meals', target: 2, points: progress >= 3 ? 60 : 40, progress: Math.min(progress, 2), complete: progress >= 2 };
    if (rule.key === 'workout' && context.restDay) return { ...rule, title: 'Rest day: an optional light session', points: 50, progress: Math.min(progress, 1), complete: progress >= 1 };
    if (rule.key === 'workout' && context.comeback) return { ...rule, title: 'Comeback: any workout counts, even 10 minutes', points: 120, progress: Math.min(progress, 1), complete: progress >= 1 };
    // Age 35+ or a reported injury/health risk: reward rating the workout (which tunes Coach) instead of chasing a maximal lift.
    if (rule.key === 'personal-record' && context.cautious) {
      const rated = todayStats.feedback ?? 0;
      return { key: 'workout-feedback', title: "Rate how today's workout felt", target: 1, points: rule.points, progress: Math.min(rated, 1), complete: rated >= 1 };
    }
    return { ...rule, progress: Math.min(progress, rule.target), complete: progress >= rule.target };
  });
}

function buildMealCountMap(mealDates: string[]): Map<string, number> {
  const allMeals = new Map<string, number>();
  for (const date of mealDates) allMeals.set(date, (allMeals.get(date) ?? 0) + 1);
  return allMeals;
}

function buildActivityDates(mealDates: string[], waterEntries: any[], allWorkoutDates: Set<string>): Set<string> {
  return new Set([
    ...mealDates,
    ...waterEntries.filter((entry: any) => entry.glasses > 0).map((entry: any) => entry.date),
    ...allWorkoutDates,
  ]);
}

function computeStreak(activityDates: Set<string>, today: string): number {
  let dayStreak = 0;
  let cursorDay = today;
  for (let days = 0; days < 365; days++) {
    if (!activityDates.has(cursorDay)) break;
    dayStreak++;
    const [year, month, day] = cursorDay.split('-').map(Number);
    cursorDay = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  }
  return dayStreak;
}

function computeExp(allMeals: Map<string, number>, allWorkouts: Set<string>, allWater: Map<string, number>): number {
  let currentExp = 0;
  const historicalDates = new Set([...allMeals.keys(), ...allWorkouts, ...allWater.keys()]);
  for (const date of historicalDates) {
    if (allWorkouts.has(date)) currentExp += 100;
    const target = mealMissionGoal(date, allMeals);
    currentExp += mealMissionPoints(allMeals.get(date) ?? 0, target);
    if ((allWater.get(date) ?? 0) >= 8) currentExp += 40;
  }
  return currentExp;
}

function buildBadges(completedWorkouts: any[], meals: { date: string; protein?: number | null; carbs?: number | null; fat?: number | null }[], allWater: Map<string, number>, activityDates: Set<string>, records: string[], rank: number | null, rankingAvailable: boolean, extras: { level: number; goalDays: Set<string>; maxLift: number | null }) {
  const longest = [...activityDates].sort().reduce((state, date) => { const previous = state.previous && new Date(`${state.previous}T00:00:00Z`); const consecutive = previous && new Date(`${date}T00:00:00Z`).getTime() - previous.getTime() === 86400000; const count = consecutive ? state.count + 1 : 1; return { previous: date, count, longest: Math.max(state.longest, count) }; }, { previous: '', count: 0, longest: 0 }).longest;
  const macros = new Map<string, { protein: number; carbs: number; fat: number; complete: boolean }>();
  for (const meal of meals) {
    if (!meal.date) continue;
    const total = macros.get(meal.date) ?? { protein: 0, carbs: 0, fat: 0, complete: true };
    for (const key of ['protein', 'carbs', 'fat'] as const) {
      const value = meal[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) total.complete = false;
      else total[key] += value;
    }
    macros.set(meal.date, total);
  }
  const early = completedWorkouts.some(workout => workout.earlyBird === true);
  const maxWater = [...allWater.values()].reduce((max, glasses) => Math.max(max, glasses), 0);
  const completeMacroDays = [...macros.values()].filter(day => day.complete);
  const macroProgress = completeMacroDays.length ? Math.round(completeMacroDays.reduce((max, day) => Math.max(max, Math.min(day.protein / 140, day.carbs / 240, day.fat / 70, 1)), 0) * 100) : meals.length ? null : 0;
  const longestGoal = [...extras.goalDays].sort().reduce((state, date) => { const next = state.previous && new Date(`${date}T00:00:00Z`).getTime() - new Date(`${state.previous}T00:00:00Z`).getTime() === 86400000; const count = next ? state.count + 1 : 1; return { previous: date, count, longest: Math.max(state.longest, count) }; }, { previous: '', count: 0, longest: 0 }).longest;
  const waterGoalDays = [...allWater.values()].filter(glasses => glasses >= 8).length;
  const levelBadge = (id: string, title: string, target: number) => ({ id, title, icon: 'medal', earned: extras.level >= target, description: `Reach level ${target}.`, progress: { current: extras.level, target, unit: 'levels' } });
  const rankBadge = (id: string, title: string, target: number) => ({ id, title, icon: 'crown', earned: rank !== null && rank <= target, available: rankingAvailable, description: rankingAvailable ? `Reach the top ${target} in all-time quest points.` : 'Leaderboard is unavailable right now.', ...(rankingAvailable ? { progressText: rank === null ? 'Earn quest points to enter the rankings.' : `Current all-time rank: #${rank}` } : {}) });
  const liftBadge = (target: number) => ({ id: `lift-${target}`, title: `${target}kg Dominator`, icon: 'dumbbell', earned: extras.maxLift !== null && extras.maxLift >= target, available: extras.maxLift !== null, description: extras.maxLift === null ? 'Saved lift data is unavailable.' : `Complete a logged set with at least ${target} kg. Self-reported loads.`, ...(extras.maxLift !== null ? { progress: { current: extras.maxLift, target, unit: 'kg lifted' } } : {}) });
  const calorieBadge = (target: number) => ({ id: `calories-${target}`, title: `${target.toLocaleString('en-US')} calories burned`, icon: 'fire', earned: false, available: false, description: 'Total calories burned are not tracked yet.' });
  return [
    { id: 'streak-3', title: 'Finding your rhythm', icon: 'fire', earned: longest >= 3, description: 'Record activity on three consecutive days.', progress: { current: Math.min(longest, 3), target: 3, unit: 'days' } },
    { id: 'streak-10', title: '10-day streak', icon: 'fire', earned: longest >= 10, description: 'Record activity on 10 consecutive days.', progress: { current: longest, target: 10, unit: 'days' } },
    { id: 'first-pr', title: 'First PR', icon: 'trophy', earned: records.length > 0, description: 'Record your first personal best.', progress: { current: Math.min(records.length, 1), target: 1, unit: 'personal record' } },
    { id: 'perfect-form', title: 'Perfect form', icon: 'medal', earned: false, available: false, description: 'Form scoring is not available yet.' },
    { id: 'hydrated', title: 'Hydrated', icon: 'water', earned: maxWater >= 8, description: 'Log 8 glasses of water in one day.', progress: { current: maxWater, target: 8, unit: 'glasses in one day' } },
    { id: 'macro-master', title: 'Macro master', icon: 'target', earned: [...macros.values()].some(day => day.complete && day.protein >= 140 && day.carbs >= 240 && day.fat >= 70), description: 'Reach 140g protein, 240g carbs and 70g fat in one day.', ...(macroProgress !== null ? { progress: { current: macroProgress, target: 100, unit: '% of closest complete day' } } : {}) },
    { id: 'streak-30', title: '30-day streak', icon: 'fire', earned: longest >= 30, description: 'Record activity on 30 consecutive days.', progress: { current: longest, target: 30, unit: 'days' } },
    { id: 'top-10', title: 'Top 10', icon: 'crown', earned: rank !== null && rank <= 10, available: rankingAvailable, description: rankingAvailable ? 'Reach the top 10 in all-time quest points.' : 'Leaderboard is unavailable right now.', ...(rankingAvailable ? { progressText: rank === null ? 'Earn quest points to enter the rankings.' : `Current all-time rank: #${rank}` } : {}) },
    { id: 'early-bird', title: 'Early bird', icon: 'sun', earned: early, description: 'Complete a workout between 5:00 and 9:00 AM in your activity timezone.', progress: { current: Number(early), target: 1, unit: 'early workout' } },
    { id: 'personal-record', title: 'New Personal Record', icon: 'trophy', earned: records.length > 0, description: 'Record a personal best.', progress: { current: Math.min(records.length, 1), target: 1, unit: 'personal record' } },
    { id: 'goal-7', title: '7-day Goal Completed', icon: 'target', earned: longestGoal >= 7, description: 'Complete all daily missions on 7 consecutive days.', progress: { current: longestGoal, target: 7, unit: 'consecutive days' } },
    rankBadge('top-100', 'Top 100 Overall Participant', 100), rankBadge('top-50', 'Top 50 Overall Participant', 50), rankBadge('top-1', 'Number 1 Overall', 1),
    { id: 'best-form', title: 'Best Form', icon: 'medal', earned: false, available: false, description: 'Verified form scoring is not available yet.' },
    levelBadge('level-beginner', 'Beginner', 1), levelBadge('level-amateur', 'Amateur', 5), levelBadge('level-pro', 'Pro', 15), levelBadge('level-veteran', 'Veteran', 30),
    calorieBadge(100), calorieBadge(1000), calorieBadge(10000), calorieBadge(100000),
    liftBadge(50), liftBadge(150),
    { id: 'hydration-20', title: 'Reach 20 Hydration Goals', icon: 'water', earned: waterGoalDays >= 20, description: 'Reach the 8-glass hydration goal on 20 separate days.', progress: { current: waterGoalDays, target: 20, unit: 'days' } },
    { id: 'streak-100', title: '100-day streak', icon: 'fire', earned: longest >= 100, description: 'Record activity on 100 consecutive days.', progress: { current: longest, target: 100, unit: 'days' } },
    { id: 'first-workout', title: 'Workout Completed', icon: 'dumbbell', earned: completedWorkouts.length > 0, description: 'Complete your first workout.', progress: { current: Number(completedWorkouts.length > 0), target: 1, unit: 'workout' } },
  ];
}
