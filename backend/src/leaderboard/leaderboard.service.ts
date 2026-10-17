import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../auth/schemas/user.schema.js';
import { Settings } from '../settings/schemas/settings.schema.js';
import { Nutrition } from '../nutrition/schemas/nutrition.schema.js';
import { WorkoutSession } from '../workouts/schemas/workout-session.schema.js';
import { LeaderboardSnapshot } from './schemas/leaderboard-snapshot.schema.js';
import { workoutCreditFilter, WORKOUT_CREDIT_POINTS } from '../workouts/workout-contract.js';

export type LeaderboardPeriod = 'week' | 'month' | 'all';

const PERIODS: LeaderboardPeriod[] = ['week', 'month', 'all'];

// Point values mirror the daily-mission rewards in ActivityService.
const WORKOUT_POINTS = WORKOUT_CREDIT_POINTS;
const MEAL_DAY_POINTS = 60;
const WATER_DAY_POINTS = 40;

export interface Standing {
  userId: string;
  name: string;
  points: number;
  rank: number;
  movement: number | 'same';
  isCurrentUser: boolean;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    @InjectModel(LeaderboardSnapshot.name) private readonly snapshots: Model<LeaderboardSnapshot>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Settings.name) private readonly settings: Model<Settings>,
    @InjectModel(Nutrition.name) private readonly nutrition: Model<Nutrition>,
    @InjectModel(WorkoutSession.name) private readonly workouts: Model<WorkoutSession>,
  ) {}

  async get(userId: string, period: LeaderboardPeriod) {
    if (!PERIODS.includes(period)) throw new BadRequestException('Period must be week, month, or all');
    const now = new Date();
    const start = this.periodStart(period, now);
    const boundaryKey = this.boundaryKey(period, start);

    const points = await this.computePoints(start);
    const names = await this.names([...points.keys(), userId]);
    const hidden = await this.hiddenUsers();

    const ranked = [...points.entries()]
      .map(([id, value]) => ({ userId: id, name: names.get(id) ?? 'Athlete', points: value }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    if (!ranked.some(entry => entry.userId === userId)) {
      ranked.push({ userId, name: names.get(userId) ?? 'You', points: 0, rank: ranked.length + 1 });
    }

    const previous = await this.previousRanks(period, boundaryKey);
    const toStanding = (entry: { userId: string; name: string; points: number; rank: number }): Standing => {
      const priorRank = previous.get(entry.userId);
      const movement = priorRank === undefined || priorRank === entry.rank ? 'same' : priorRank - entry.rank;
      return { ...entry, movement, isCurrentUser: entry.userId === userId };
    };

    const entries = ranked
      .filter(entry => entry.userId === userId || !hidden.has(entry.userId))
      .map(toStanding);
    const self = entries.find(entry => entry.isCurrentUser) ?? toStanding(ranked.find(entry => entry.userId === userId)!);
    const above = entries
      .filter(entry => entry.rank < self.rank)
      .sort((a, b) => b.rank - a.rank)[0];

    void this.captureSnapshot(period, boundaryKey, ranked)
      .catch(() => this.logger.warn('Failed to capture leaderboard history snapshot'));

    return {
      period,
      creditPolicyVersion: 2,
      creditPolicy: 'Workout credit is awarded once per training day. Historical totals use this rule too. Competition weeks start Monday at 00:00 UTC.',
      entries,
      self,
      context: above ? { previousName: above.name, pointsBehind: above.points - self.points } : null,
    };
  }

  /** Sum of period points per user from completed workouts, meals, and water. */
  private async computePoints(start: Date | null): Promise<Map<string, number>> {
    const [workouts, nutrition] = await Promise.all([
      this.workouts.aggregate<{ userId: string; day: string }>([
        { $match: { status: 'completed', endedAt: { $type: 'date' }, ...workoutCreditFilter } },
        { $group: { _id: { userId: '$userId', day: { $ifNull: ['$activityDate', { $dateToString: { date: '$endedAt', format: '%Y-%m-%d', timezone: { $ifNull: ['$timezone', 'UTC'] } } }] } }, firstAt: { $min: '$endedAt' } } },
        ...(start ? [{ $match: { firstAt: { $gte: start } } }] : []),
        { $project: { _id: 0, userId: '$_id.userId', day: '$_id.day' } },
      ]),
      this.nutrition.find({}).select('userId meals water').lean().exec(),
    ]);

    const points = new Map<string, number>();
    const add = (id: string, value: number) => points.set(id, (points.get(id) ?? 0) + value);

    for (const workout of workouts) {
      if (workout.day) add(String(workout.userId), WORKOUT_POINTS);
    }

    const startDate = start ? start.toISOString().slice(0, 10) : '0000-00-00';
    for (const record of nutrition as { userId: unknown; meals?: { date: string }[]; water?: { date: string; glasses: number }[] }[]) {
      const id = String(record.userId);
      const mealDays = new Map<string, number>();
      for (const meal of record.meals ?? []) {
        if (meal.date && meal.date >= startDate) mealDays.set(meal.date, (mealDays.get(meal.date) ?? 0) + 1);
      }
      for (const count of mealDays.values()) if (count >= 3) add(id, MEAL_DAY_POINTS);
      for (const entry of record.water ?? []) if (entry.date && entry.date >= startDate && entry.glasses >= 8) add(id, WATER_DAY_POINTS);
    }
    return points;
  }

  private async names(ids: string[]): Promise<Map<string, string>> {
    const valid = ids.filter(id => Types.ObjectId.isValid(id));
    if (!valid.length) return new Map();
    const users = await this.users.find({ _id: { $in: valid.map(id => new Types.ObjectId(id)) } }).select('name').lean().exec();
    return new Map((users as { _id: unknown; name?: string }[]).map(user => [String(user._id), user.name ?? 'Athlete']));
  }

  /** Users who turned off leaderboard visibility in privacy settings. */
  private async hiddenUsers(): Promise<Set<string>> {
    const records = await this.settings.find({}).select('userId values').lean().exec();
    return new Set(
      (records as { userId: unknown; values?: Record<string, unknown> }[])
        .filter(record => record.values?.showLeaderboard === false)
        .map(record => String(record.userId)),
    );
  }

  /** Ranks captured for the most recent boundary before the current one. */
  private async previousRanks(period: LeaderboardPeriod, boundaryKey: string): Promise<Map<string, number>> {
    const snapshot = await this.snapshots.find({ period, creditPolicyVersion: 2, boundaryKey: { $lt: boundaryKey } }).sort({ boundaryKey: -1, rank: 1 }).limit(500).lean().exec();
    if (!snapshot.length) return new Map();
    const latest = (snapshot[0] as { boundaryKey: string }).boundaryKey;
    return new Map(
      (snapshot as { boundaryKey: string; subjectId: unknown; rank: number }[])
        .filter(record => record.boundaryKey === latest)
        .map(record => [String(record.subjectId), record.rank]),
    );
  }

  private async captureSnapshot(period: LeaderboardPeriod, boundaryKey: string, ranked: { userId: string; rank: number; points: number }[]) {
    if (!ranked.length) return;
    await this.snapshots.bulkWrite(
      ranked
        .filter(entry => Types.ObjectId.isValid(entry.userId))
        .map(entry => ({
          updateOne: {
            filter: { period, boundaryKey, subjectId: new Types.ObjectId(entry.userId) },
            update: { $set: { rank: entry.rank, points: entry.points, creditPolicyVersion: 2 } },
            upsert: true,
          },
        })),
    );
  }

  private periodStart(period: LeaderboardPeriod, now: Date): Date | null {
    if (period === 'all') return null;
    if (period === 'month') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const day = now.getUTCDay();
    const mondayOffset = (day + 6) % 7;
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - mondayOffset));
    return monday;
  }

  private boundaryKey(period: LeaderboardPeriod, start: Date | null): string {
    if (period === 'all' || !start) return 'all';
    if (period === 'month') return start.toISOString().slice(0, 7);
    return start.toISOString().slice(0, 10);
  }
}
