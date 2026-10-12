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
    const [usersTotal, completedSessions, totalAlerts, deliveredAlerts, failedAlerts, pendingAlerts, signIns] = await Promise.all([
      this.users.countDocuments({ isActive: true }),
      this.workouts.countDocuments({ status: 'completed', endedAt: { $gte: start, $lte: end } }),
      this.alerts.countDocuments(eventFilter),
      this.alerts.countDocuments({ ...eventFilter, status: 'delivered' }),
      this.alerts.countDocuments({ ...eventFilter, status: 'failed' }),
      this.alerts.countDocuments({ ...eventFilter, status: 'pending' }),
      this.signInEvents.find({ occurredAt: { $gte: start, $lte: end } }).select('userId occurredAt').lean().exec(),
    ]);
    const { activeUsers, weeklyRetention } = this.summarizeSignIns(signIns as { userId: unknown; occurredAt: Date }[], start, days);
    return {
      rangeDays: days, generatedAt: end.toISOString(), usersTotal, activeUsers,
      completedSessions, formScore: null, missionCompletion: null, weeklyRetention,
      emergencyEvents: { total: totalAlerts, delivered: deliveredAlerts, failed: failedAlerts, pending: pendingAlerts },
    };
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
