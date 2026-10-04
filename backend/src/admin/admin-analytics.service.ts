import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../auth/schemas/user.schema.js';
import { WorkoutSession } from '../workouts/schemas/workout-session.schema.js';
import { AlertEvent } from '../safety/schemas/alert-event.schema.js';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(WorkoutSession.name) private readonly workouts: Model<WorkoutSession>,
    @InjectModel(AlertEvent.name) private readonly alerts: Model<AlertEvent>,
  ) {}
  async get(days: number) {
    if (![7, 30, 90].includes(days)) throw new BadRequestException('Range must be 7, 30, or 90 days');
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const eventFilter = { createdAt: { $gte: start, $lte: end } };
    const [usersTotal, completedSessions, totalAlerts, deliveredAlerts, failedAlerts, pendingAlerts] = await Promise.all([
      this.users.countDocuments({ isActive: true }),
      this.workouts.countDocuments({ status: 'completed', endedAt: { $gte: start, $lte: end } }),
      this.alerts.countDocuments(eventFilter),
      this.alerts.countDocuments({ ...eventFilter, status: 'delivered' }),
      this.alerts.countDocuments({ ...eventFilter, status: 'failed' }),
      this.alerts.countDocuments({ ...eventFilter, status: 'pending' }),
    ]);
    return {
      rangeDays: days, generatedAt: end.toISOString(), usersTotal, activeUsers: null,
      completedSessions, formScore: null, missionCompletion: null, weeklyRetention: null,
      emergencyEvents: { total: totalAlerts, delivered: deliveredAlerts, failed: failedAlerts, pending: pendingAlerts },
    };
  }
}
