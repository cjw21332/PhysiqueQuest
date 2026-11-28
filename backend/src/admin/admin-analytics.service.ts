import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../auth/schemas/user.schema.js';
import { SignInEvent } from '../auth/schemas/sign-in-event.schema.js';
import { WorkoutSession } from '../workouts/schemas/workout-session.schema.js';
import { AlertEvent } from '../safety/schemas/alert-event.schema.js';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(WorkoutSession.name) private readonly workouts: Model<WorkoutSession>,
    @InjectModel(AlertEvent.name) private readonly alerts: Model<AlertEvent>,
    @InjectModel(SignInEvent.name) private readonly signInEvents: Model<SignInEvent>,
  ) {}
  async get(days: number) {
    if (![7, 30, 90].includes(days)) throw new BadRequestException('Range must be 7, 30, or 90 days');
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const eventFilter = { createdAt: { $gte: start, $lte: end } };
    const [usersTotal, newUsers, completedSessions, totalAlerts, deliveredAlerts, failedAlerts, pendingAlerts, signIns] = await Promise.all([
      this.users.countDocuments({ isActive: true, role: { $ne: 'admin' } }),
      this.users.countDocuments({ isActive: true, role: { $ne: 'admin' }, createdAt: { $gte: start, $lte: end } }),
      this.workouts.countDocuments({ status: 'completed', endedAt: { $gte: start, $lte: end } }),
      this.alerts.countDocuments(eventFilter),
      this.alerts.countDocuments({ ...eventFilter, status: 'delivered' }),
      this.alerts.countDocuments({ ...eventFilter, status: 'failed' }),
      this.alerts.countDocuments({ ...eventFilter, status: 'pending' }),
      this.signInEvents.find({ occurredAt: { $gte: start, $lte: end } }).select('userId occurredAt').lean().exec(),
    ]);
    // Some isolated service consumers provide only a count model. In that case
    // feedback is unavailable, rather than silently reporting a zero count.
    const appFeedback = this.users.db ? await (async () => {
      const collection = this.users.db.collection('app_feedback');
      const [summary, feedbackRows] = await Promise.all([
        collection.aggregate([{ $match: eventFilter }, { $group: { _id: null, count: { $sum: 1 }, averageRating: { $avg: '$rating' }, pending: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$adminStatus', 'new'] }, 'resolved'] }, 1, 0] } } } }]).toArray(),
        collection.find(eventFilter, { projection: { _id: 0, rating: 1, category: 1, message: 1, platform: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(10).toArray(),
      ]);
      return { count: Number(summary[0]?.count ?? 0), pending: Number(summary[0]?.pending ?? 0), averageRating: summary[0] ? Math.round(Number(summary[0].averageRating) * 10) / 10 : null,
        recent: feedbackRows.map(row => ({ rating: row.rating, category: row.category, message: row.message, platform: row.platform ?? null, createdAt: row.createdAt })) };
    })() : undefined;
    const { activeUsers, weeklyRetention } = this.summarizeSignIns(signIns as { userId: unknown; occurredAt: Date }[], start, days);
    const trend = this.users.db ? await this.dailyTrend(start, end, signIns as { userId: unknown; occurredAt: Date }[]) : undefined;
    return {
      rangeDays: days, generatedAt: end.toISOString(), usersTotal, newUsers, activeUsers,
      completedSessions, formScore: null, missionCompletion: null, weeklyRetention,
      emergencyEvents: { total: totalAlerts, delivered: deliveredAlerts, failed: failedAlerts, pending: pendingAlerts },
      appFeedback, trend,
    };
  }

  /** Per-UTC-day new accounts, distinct sign-ins and completed workouts for the overview chart. */
  private async dailyTrend(start: Date, end: Date, signIns: { userId: unknown; occurredAt: Date }[]) {
    const [created, finished] = await Promise.all([
      this.users.find({ isActive: true, role: { $ne: 'admin' }, createdAt: { $gte: start, $lte: end } }).select('createdAt').lean().exec(),
      this.workouts.find({ status: 'completed', endedAt: { $gte: start, $lte: end } }).select('endedAt').lean().exec(),
    ]);
    const key = (value: Date | string | number) => new Date(value).toISOString().slice(0, 10);
    const days = new Map<string, { date: string; newUsers: number; activeUsers: number; workouts: number; ids: Set<string> }>();
    for (let time = Date.parse(`${key(start)}T00:00:00.000Z`); time <= end.getTime(); time += 86_400_000) days.set(key(time), { date: key(time), newUsers: 0, activeUsers: 0, workouts: 0, ids: new Set() });
    for (const row of created as { createdAt?: Date }[]) if (row.createdAt) { const day = days.get(key(row.createdAt)); if (day) day.newUsers += 1; }
    for (const row of finished as { endedAt?: Date }[]) if (row.endedAt) { const day = days.get(key(row.endedAt)); if (day) day.workouts += 1; }
    for (const row of signIns) days.get(key(row.occurredAt))?.ids.add(String(row.userId));
    return [...days.values()].map(({ ids, ...day }) => ({ ...day, activeUsers: ids.size }));
  }

  /**
   * Turns raw sign-in rows into the two analytics the UI reads:
   *
   * - `activeUsers`: how many distinct users signed in during the range.
   * - `weeklyRetention`: week-over-week percentages. Each entry is the share of
   *   users active in the previous week who returned the following week, so a
   *   range shorter than two weeks yields an empty array rather than a guess.
   */
  private summarizeSignIns(events: { userId: unknown; occurredAt: Date }[], start: Date, days: number) {
    const weeks = Math.max(1, Math.ceil(days / 7));
    const perWeek = Array.from({ length: weeks }, () => new Set<string>());
    const allActive = new Set<string>();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    for (const event of events) {
      const id = String(event.userId);
      allActive.add(id);
      const index = Math.min(weeks - 1, Math.max(0, Math.floor((new Date(event.occurredAt).getTime() - start.getTime()) / weekMs)));
      perWeek[index].add(id);
    }
    const weeklyRetention: number[] = [];
    for (let week = 1; week < weeks; week += 1) {
      const previous = perWeek[week - 1];
      if (previous.size === 0) {
        weeklyRetention.push(0);
        continue;
      }
      let retained = 0;
      for (const id of perWeek[week]) if (previous.has(id)) retained += 1;
      weeklyRetention.push(Math.round((retained / previous.size) * 100));
    }
    return { activeUsers: allActive.size, weeklyRetention };
  }
}
