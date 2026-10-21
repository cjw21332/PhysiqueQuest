import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import type { Connection } from 'mongoose';
import { decryptProfile } from '../privacy/health-encryption.js';

const resources = {
  workouts: { collection: 'workout_sessions', fields: ['exerciseIds', 'startedAt', 'endedAt', 'pausedAt', 'pausedSeconds', 'status', 'durationSeconds', 'exerciseResults', 'exercises', 'sets', 'revision', 'origin', 'programVersion', 'dayIndex', 'scheduledDate', 'timezone', 'activityDate'] },
  progress: { collection: 'progress_entries', fields: ['metric', 'value', 'unit', 'measuredAt'] },
} as const;
type Resource = keyof typeof resources;
type Cursor = { owner: string; resource: Resource; since: string | null; at: string; last: string; upper: string };
const singletonFields = {
  profiles: ['name', 'age', 'height', 'heightInches', 'heightUnit', 'weight', 'weightUnit', 'gender', 'chest', 'waist', 'arms', 'chestUnit', 'waistUnit', 'armsUnit', 'measurementUnit', 'activity', 'goal', 'targetWeight', 'targetDate', 'seriousness', 'equipment', 'days', 'duration', 'conditions', 'healthNotes', 'contactName', 'contactPhone', 'contactRelationship'],
  settings: ['values'], activity: ['state'], nutrition: ['meals', 'water'], notifications: ['items'],
} as const;
function projection(fields: readonly string[]) { return Object.fromEntries(['_id', 'userId', 'createdAt', 'updatedAt', ...fields].map(key => [key, 1])); }
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));

@Injectable()
export class SyncService {
  constructor(@InjectConnection() private readonly connection: Connection) {}
  private signature(body: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('Sync signing unavailable');
    return createHmac('sha256', secret).update(`sync:v1:${body}`).digest();
  }
  private encode(cursor: Cursor) {
    const body = Buffer.from(JSON.stringify(cursor)).toString('base64url');
    return `${body}.${this.signature(body).toString('base64url')}`;
  }
  private decode(value: string): Cursor {
    try {
      if (value.length > 2000) throw new Error();
      const [body, signed, extra] = value.split('.');
      const signature = Buffer.from(signed, 'base64url');
      const expected = this.signature(body);
      if (extra || signature.length !== expected.length || !timingSafeEqual(signature, expected)) throw new Error();
      const cursor = JSON.parse(Buffer.from(body, 'base64url').toString()) as Cursor;
      if (!validDate(cursor.at) || Date.now() - Date.parse(cursor.at) > 3600000 || Date.parse(cursor.at) > Date.now() + 60000 ||
        !/^[a-f0-9]{24}$/.test(cursor.last) || !/^[a-f0-9]{24}$/.test(cursor.upper) ||
        (cursor.since !== null && !validDate(cursor.since))) throw new Error();
      return cursor;
    } catch { throw new BadRequestException('Invalid or expired sync cursor; restart synchronization'); }
  }

  async page(owner: string, query: Record<string, unknown>) {
    if (Object.keys(query).some(key => !['resource', 'since', 'cursor', 'limit'].includes(key)) || Object.values(query).some(value => typeof value !== 'string')) throw new BadRequestException('Invalid sync query');
    const resource = query.resource as Resource;
    if (!Object.hasOwn(resources, resource)) throw new BadRequestException('Invalid sync resource');
    const limit = query.limit === undefined ? 50 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('Sync limit must be 1–100');
    const since = query.since === undefined ? null : query.since as string;
    if (since !== null && (!validDate(since) || Date.parse(since) > Date.now())) throw new BadRequestException('Invalid sync timestamp');
    const collection = this.connection.collection(resources[resource].collection);
    const userId = new Types.ObjectId(owner);
    let cursor: Cursor;
    if (query.cursor) {
      cursor = this.decode(query.cursor as string);
      if (cursor.owner !== owner || cursor.resource !== resource || cursor.since !== since) throw new BadRequestException('Sync cursor does not match request');
    } else {
      const upper = await collection.findOne({ userId }, { sort: { _id: -1 }, projection: { _id: 1 } });
      cursor = { owner, resource, since, at: new Date().toISOString(), last: '000000000000000000000000', upper: upper ? String(upper._id) : '000000000000000000000000' };
    }
    const inventory = await collection.find({ userId, _id: { $gt: new Types.ObjectId(cursor.last), $lte: new Types.ObjectId(cursor.upper) } },
      { projection: { _id: 1, updatedAt: 1 } }).sort({ _id: 1 }).limit(limit + 1).toArray();
    const complete = inventory.length <= limit;
    const page = inventory.slice(0, limit);
    const changed = page.filter(row => !since || !row.updatedAt || new Date(row.updatedAt).getTime() >= Date.parse(since));
    const upserts = changed.length ? await collection.find({ userId, _id: { $in: changed.map(row => row._id) } },
      { projection: projection(resources[resource].fields) }).sort({ _id: 1 }).toArray() : [];
    return { resource, inventoryIds: page.map(row => String(row._id)), upserts, complete,
      // Re-read the boundary millisecond on the next sync so equal timestamps cannot lose writes.
      watermark: new Date(Date.parse(cursor.at) - 1).toISOString(),
      nextCursor: complete ? null : this.encode({ ...cursor, last: String(page.at(-1)!._id) }),
      reconciliation: 'Stage inventory across all pages; only on complete remove cached IDs absent from inventory.' };
  }

  async snapshots(owner: string) {
    const userId = new Types.ObjectId(owner);
    const entries = await Promise.all(Object.entries(singletonFields).map(async ([name, fields]) => {
      const selected: Record<string, any> = projection(fields);
      if (name === 'nutrition') { selected.meals = { $slice: -100 }; selected.water = { $slice: -100 }; }
      if (name === 'notifications') selected.items = { $slice: -100 };
      const row = await this.connection.collection(name).findOne({ userId }, { projection: selected });
      return [name, name === 'profiles' && row ? decryptProfile(row) : row];
    }));
    return { snapshots: Object.fromEntries(entries), replace: true, embeddedArrayWindow: 100, at: new Date().toISOString() };
  }

  async dashboard(owner: string) {
    const userId = new Types.ObjectId(owner);
    const [profile, workouts, progress, notifications] = await Promise.all([
      this.connection.collection('profiles').findOne({ userId }, { projection: { name: 1, goal: 1, activity: 1 } }),
      this.connection.collection('workout_sessions').find({ userId }, { projection: { status: 1, startedAt: 1, endedAt: 1, durationSeconds: 1 } }).sort({ startedAt: -1, _id: -1 }).limit(10).toArray(),
      this.connection.collection('progress_entries').find({ userId }, { projection: { metric: 1, value: 1, unit: 1, measuredAt: 1 } }).sort({ measuredAt: -1, _id: -1 }).limit(10).toArray(),
      this.connection.collection('notifications').findOne({ userId }, { projection: { items: { $slice: -10 } } }),
    ]);
    return { profile, workouts, progress, notifications: notifications?.items ?? [] };
  }
}
