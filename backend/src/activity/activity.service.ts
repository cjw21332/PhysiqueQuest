import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NutritionService } from '../nutrition/nutrition.service.js';
import { WorkoutsService } from '../workouts/workouts.service.js';
import { UpdateActivityDto } from './dto/activity.dto.js';
import { Activity } from './schemas/activity.schema.js';
import { activityDate, earnsWorkoutCredit } from '../workouts/workout-contract.js';
import { LeaderboardService } from '../leaderboard/leaderboard.service.js';

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
  ) {}

  private async userState(userId: string) {
    return this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), state: { timezone: 'UTC' } } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
  }

  async get(userId: string, requestedTimezone?: string) {
    const record = await this.model.findOne({ userId: new Types.ObjectId(userId) }).exec();
    const timezone = resolveTimezone(requestedTimezone ?? record?.state?.timezone);
    const [nutrition, workouts, records, ranking] = await Promise.all([this.nutrition.read(userId, 'userId meals.date meals.protein meals.carbs meals.fat water.date water.glasses'), this.workouts.creditHistory(userId, timezone), this.workouts.personalRecordDays(userId, timezone), this.leaderboard.get(userId, 'all').catch(() => null)]);
    const today = zoneDate(new Date(), timezone);

    const mealDates = nutrition.meals.map(meal => meal.date).filter((date): date is string => typeof date === 'string');
    const waterByDate = new Map(nutrition.water.map(entry => [entry.date, entry.glasses]));
    const completedWorkouts = workouts.filter(workout => earnsWorkoutCredit(workout) && workout.endedAt);

    const todayStats = computeTodayStats(nutrition, completedWorkouts, waterByDate, today, timezone);
    const dailyMissions = buildDailyMissions({ ...todayStats, records: Number(records.includes(today)) });

    const allMeals = buildMealCountMap(mealDates);
    const allWorkoutDates = new Set(completedWorkouts.map(workout => workout.activityDate || activityDate(workout.endedAt!, timezone)));
    const activityDates = buildActivityDates(mealDates, nutrition.water, allWorkoutDates);

    const dayStreak = computeStreak(activityDates, today);
    const currentExp = computeExp(allMeals, allWorkoutDates, waterByDate) + records.length * 150;
    const earnedPoints = dailyMissions.filter(m => m.complete).reduce((sum, m) => sum + m.points, 0);
    const badges = buildBadges(completedWorkouts, nutrition.meals, waterByDate, activityDates, records, ranking?.self.points ? ranking.self.rank : null, ranking !== null);

    return {
      state: {
        timezone,
        questProgress: {
          workout: Math.min(todayStats.workouts, 1),
          meals: Math.min(todayStats.meals, 3),
          water: Math.min(todayStats.water, 8),
        },
        level: Math.floor(currentExp / 100) + 1,
        currentExp: currentExp % 100,
        nextLevelExp: 100,
        dayStreak,
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
    await current.save();
    return this.get(userId);
  }
}

function resolveTimezone(requested?: unknown): string {
  let timezone = typeof requested === 'string' ? requested : 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
  catch { timezone = 'UTC'; }
  return timezone;
}

function computeTodayStats(nutrition: any, completedWorkouts: any[], waterByDate: Map<string, number>, today: string, timezone: string) {
  return {
    meals: nutrition.meals.filter((m: any) => m.date === today).length,
    water: waterByDate.get(today) ?? 0,
    workouts: completedWorkouts.filter(w => (w.activityDate || activityDate(w.endedAt!, w.timezone ?? timezone)) === today).length,
  };
}

function buildDailyMissions(todayStats: { meals: number, water: number, workouts: number, records: number }) {
  return missionRules.map(rule => {
    const progress = rule.key === 'workout' ? todayStats.workouts :
                     rule.key === 'meals' ? todayStats.meals :
                     rule.key === 'water' ? todayStats.water : todayStats.records;
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
    if ((allMeals.get(date) ?? 0) >= 3) currentExp += 60;
    if ((allWater.get(date) ?? 0) >= 8) currentExp += 40;
  }
  return currentExp;
}

function buildBadges(completedWorkouts: any[], meals: { date: string; protein?: number; carbs?: number; fat?: number }[], allWater: Map<string, number>, activityDates: Set<string>, records: string[], rank: number | null, rankingAvailable: boolean) {
  const longest = [...activityDates].sort().reduce((state, date) => { const previous = state.previous && new Date(`${state.previous}T00:00:00Z`); const consecutive = previous && new Date(`${date}T00:00:00Z`).getTime() - previous.getTime() === 86400000; const count = consecutive ? state.count + 1 : 1; return { previous: date, count, longest: Math.max(state.longest, count) }; }, { previous: '', count: 0, longest: 0 }).longest;
  const macros = new Map<string, { protein: number; carbs: number; fat: number }>();
  for (const meal of meals) { if (!meal.date) continue; const total = macros.get(meal.date) ?? { protein: 0, carbs: 0, fat: 0 }; total.protein += meal.protein ?? 0; total.carbs += meal.carbs ?? 0; total.fat += meal.fat ?? 0; macros.set(meal.date, total); }
  const early = completedWorkouts.some(workout => workout.earlyBird === true);
  return [
    { id: 'streak-10', title: '10-day streak', icon: 'fire', earned: longest >= 10 },
    { id: 'first-pr', title: 'First PR', icon: 'trophy', earned: records.length > 0 },
    { id: 'perfect-form', title: 'Perfect form', icon: 'medal', earned: false, available: false, description: 'Form scoring is not available yet.' },
    { id: 'hydrated', title: 'Hydrated', icon: 'water', earned: [...allWater.values()].some(glasses => glasses >= 8) },
    { id: 'macro-master', title: 'Macro master', icon: 'target', earned: [...macros.values()].some(day => day.protein >= 140 && day.carbs >= 240 && day.fat >= 70), description: 'Reach the app’s current daily protein, carb and fat targets.' },
    { id: 'streak-30', title: '30-day streak', icon: 'fire', earned: longest >= 30 },
    { id: 'top-10', title: 'Top 10', icon: 'crown', earned: rank !== null && rank <= 10, available: rankingAvailable, description: rankingAvailable ? 'Reach the top 10 in all-time quest points.' : 'Leaderboard is unavailable right now.' },
    { id: 'early-bird', title: 'Early bird', icon: 'sun', earned: early, description: 'Complete a workout between 5:00 and 9:00 AM in your activity timezone.' },
  ];
}
