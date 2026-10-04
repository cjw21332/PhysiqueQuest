import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NutritionService } from '../nutrition/nutrition.service.js';
import { WorkoutsService } from '../workouts/workouts.service.js';
import { UpdateActivityDto } from './dto/activity.dto.js';
import { Activity } from './schemas/activity.schema.js';

const missionRules = [
  { key: 'workout', title: 'Complete one workout', target: 1, points: 100 },
  { key: 'meals', title: 'Log 3 meals', target: 3, points: 60 },
  { key: 'water', title: 'Drink 8 glasses of water', target: 8, points: 40 },
] as const;
const zoneDate = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
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
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async get(userId: string) {
    const [record, nutrition, workouts] = await Promise.all([
      this.userState(userId), this.nutrition.get(userId), this.workouts.list(userId, 100),
    ]);
    const requestedTimezone = typeof record.state?.timezone === 'string' ? record.state.timezone : 'UTC';
    let timezone = requestedTimezone;
    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
    catch { timezone = 'UTC'; }
    const today = zoneDate(new Date(), timezone);
    const mealDates = nutrition.meals.map(meal => meal.date).filter((date): date is string => typeof date === 'string');
    const waterByDate = new Map(nutrition.water.map(entry => [entry.date, entry.glasses]));
    const completedWorkouts = workouts.filter(workout => workout.status === 'completed' && workout.endedAt);
    const todayMeals = nutrition.meals.filter(meal => meal.date === today).length;
    const todayWater = waterByDate.get(today) ?? 0;
    const todayWorkouts = completedWorkouts.filter(workout => zoneDate(new Date(workout.endedAt!), timezone) === today).length;
    const dailyMissions = missionRules.map(rule => {
      const progress = rule.key === 'workout' ? todayWorkouts : rule.key === 'meals' ? todayMeals : todayWater;
      return { ...rule, progress: Math.min(progress, rule.target), complete: progress >= rule.target };
    });

    const activityDates = new Set([...mealDates, ...nutrition.water.filter(entry => entry.glasses > 0).map(entry => entry.date), ...completedWorkouts.map(workout => zoneDate(new Date(workout.endedAt!), timezone))]);
    let dayStreak = 0;
    let cursorDay = today;
    for (let days = 0; days < 365; days++) {
      if (!activityDates.has(cursorDay)) break;
      dayStreak++;
      const [year, month, day] = cursorDay.split('-').map(Number);
      cursorDay = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
    }
    const earnedPoints = dailyMissions.filter(mission => mission.complete).reduce((sum, mission) => sum + mission.points, 0);
    const allMeals = new Map<string, number>();
    for (const date of mealDates) allMeals.set(date, (allMeals.get(date) ?? 0) + 1);
    const allWorkouts = new Set(completedWorkouts.map(workout => zoneDate(new Date(workout.endedAt!), timezone)));
    const allWater = new Map(nutrition.water.map(entry => [entry.date, entry.glasses]));
    const historicalDates = new Set([...allMeals.keys(), ...allWorkouts, ...allWater.keys()]);
    let currentExp = 0;
    for (const date of historicalDates) {
      if (allWorkouts.has(date)) currentExp += 100;
      if ((allMeals.get(date) ?? 0) >= 3) currentExp += 60;
      if ((allWater.get(date) ?? 0) >= 8) currentExp += 40;
    }
    const badges = [
      { id: 'first-workout', title: 'First workout', icon: 'dumbbell', earned: completedWorkouts.length > 0 },
      { id: 'meal-logger', title: 'Three meals in a day', icon: 'meal', earned: [...allMeals.values()].some(count => count >= 3) },
      { id: 'hydrated', title: 'Eight glasses logged', icon: 'water', earned: [...allWater.values()].some(glasses => glasses >= 8) },
    ];
    return {
      state: { timezone, questProgress: { workout: Math.min(todayWorkouts, 1), meals: Math.min(todayMeals, 3), water: Math.min(todayWater, 8) }, level: Math.floor(currentExp / 100) + 1, currentExp: currentExp % 100, nextLevelExp: 100, dayStreak, earnedPoints },
      dailyMissions, badges,
    };
  }

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
