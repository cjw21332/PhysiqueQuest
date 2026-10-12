import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { User } from '../auth/schemas/user.schema.js';
import { AlertEvent, AlertStatus } from '../safety/schemas/alert-event.schema.js';

const STATUSES: readonly AlertStatus[] = ['pending', 'delivered', 'failed', 'cancelled'];

@Injectable()
export class AdminAlertsService {
  constructor(
    @InjectModel(AlertEvent.name) private readonly alerts: Model<AlertEvent>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async list(days: number, status?: string) {
    if (![7, 30, 90].includes(days)) throw new BadRequestException('Range must be 7, 30, or 90 days');
    if (status && !(STATUSES as readonly string[]).includes(status)) throw new BadRequestException('Unknown alert status');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const filter: { createdAt: { $gte: Date }; status?: AlertStatus } = { createdAt: { $gte: since } };
    if (status) filter.status = status as AlertStatus;
    const events = await this.alerts.find(filter).sort({ createdAt: -1 }).limit(200).lean().exec();
    // One query for all names in the page, not one per row.
    const ids = [...new Set(events.map(event => String(event.userId)))];
    const people = await this.users.find({ _id: { $in: ids } }, { name: 1 }).lean().exec();
    const names = new Map(people.map(person => [String(person._id), person.name]));
    return events.map(event => ({
      id: String(event._id),
      userName: names.get(String(event.userId)) ?? 'Unknown user',
      eventType: event.eventType,
      status: event.status,
      errorCode: event.errorCode ?? null,
      occurredAt: event.occurredAt,
      resolvedAt: event.resolvedAt ?? null,
      flagged: event.flagged,
      exerciseId: event.exerciseId ?? null,
      // Only whether location was shared. Coordinates never leave the database through this endpoint.
      locationShared: Boolean(event.location),
    }));
  }
}
