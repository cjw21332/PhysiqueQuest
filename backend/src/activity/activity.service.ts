import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NutritionService } from '../nutrition/nutrition.service.js';
import { WorkoutsService } from '../workouts/workouts.service.js';
import { UpdateActivityDto } from './dto/activity.dto.js';
import { Activity } from './schemas/activity.schema.js';
import { activityDate, earnsWorkoutCredit } from '../workouts/workout-contract.js';

const missionRules = [
  { key: 'workout', title: 'Complete one workout', target: 1, points: 100 },
  { key: 'meals', title: 'Log 3 meals', target: 3, points: 60 },
  { key: 'water', title: 'Drink 8 glasses of water', target: 8, points: 40 },
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
    const [nutrition, workouts] = await Promise.all([this.nutrition.read(userId, 'userId meals.date water.date water.glasses'), this.workouts.creditHistory(userId, timezone)]);
    const today = zoneDate(new Date(), timezone);

    const mealDates = nutrition.meals.map(meal => meal.date).filter((date): date is string => typeof date === 'string');
    const waterByDate = new Map(nutrition.water.map(entry => [entry.date, entry.glasses]));
    const completedWorkouts = workouts.filter(workout => earnsWorkoutCredit(workout) && workout.endedAt);

    const todayStats = computeTodayStats(nutrition, completedWorkouts, waterByDate, today, timezone);
    const dailyMissions = buildDailyMissions(todayStats);

    const allMeals = buildMealCountMap(mealDates);
    const allWorkoutDates = new Set(completedWorkouts.map(workout => workout.activityDate || activityDate(workout.endedAt!, timezone)));
    const activityDates = buildActivityDates(mealDates, nutrition.water, allWorkoutDates);

    const dayStreak = computeStreak(activityDates, today);
    const currentExp = computeExp(allMeals, allWorkoutDates, waterByDate);
    const earnedPoints = dailyMissions.filter(m => m.complete).reduce((sum, m) => sum + m.points, 0);
    const badges = buildBadges(completedWorkouts, allMeals, waterByDate);

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

function buildDailyMissions(todayStats: { meals: number, water: number, workouts: number }) {
  return missionRules.map(rule => {
    const progress = rule.key === 'workout' ? todayStats.workouts :
                     rule.key === 'meals' ? todayStats.meals :
                     todayStats.water;
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

function buildBadges(completedWorkouts: any[], allMeals: Map<string, number>, allWater: Map<string, number>) {
  return [
    { id: 'first-workout', title: 'First workout', icon: 'dumbbell', earned: completedWorkouts.length > 0 },
    { id: 'meal-logger', title: 'Three meals in a day', icon: 'meal', earned: [...allMeals.values()].some(count => count >= 3) },
    { id: 'hydrated', title: 'Eight glasses logged', icon: 'water', earned: [...allWater.values()].some(glasses => glasses >= 8) },
  ];
}
