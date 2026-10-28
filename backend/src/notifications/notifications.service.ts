import { BadRequestException, Injectable, Logger, NotFoundException, Optional, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Notifications } from './schemas/notification.schema.js';
import { PushService } from '../push/push.service.js';
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(@InjectModel(Notifications.name) private readonly model: Model<Notifications>, @Optional() private readonly push?: PushService) {}
  onModuleInit() { void this.sendReminders(); this.timer = setInterval(() => { void this.sendReminders(); }, 60_000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async get(userId: string) { return this.model.findOneAndUpdate({ userId: new Types.ObjectId(userId) }, { $setOnInsert: { userId: new Types.ObjectId(userId), items: [] } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }); }
  async mark(userId: string, id: string, unread: boolean) {
    const updated = await this.model.findOneAndUpdate({ userId: new Types.ObjectId(userId), 'items.id': id }, { $set: { 'items.$.unread': unread } }, { returnDocument: 'after' });
    if (!updated) throw new NotFoundException('Notification not found');
    return updated;
  }
  async markAll(userId: string) {
    await this.get(userId);
    return this.model.findOneAndUpdate({ userId: new Types.ObjectId(userId) }, { $set: { 'items.$[].unread': false } }, { returnDocument: 'after' });
  }
  async setReminder(userId: string, reminder: { enabled: boolean; hour: number; minute: number; timezone: string }) {
    try { new Intl.DateTimeFormat('en', { timeZone: reminder.timezone }); } catch { throw new BadRequestException('Choose a valid timezone'); }
    return this.model.findOneAndUpdate({ userId: new Types.ObjectId(userId) }, { $set: { reminder }, $setOnInsert: { userId: new Types.ObjectId(userId), items: [] } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
  }
  async sendReminders(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const records = this.model.find({ 'reminder.enabled': true }).select('userId reminder').lean().cursor();
      for await (const record of records) {
        const reminder = record.reminder;
        if (!reminder) continue;
        try {
          const parts = new Intl.DateTimeFormat('en-CA', { timeZone: reminder.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
          const part = (type: string) => parts.find(value => value.type === type)?.value ?? '';
          const minutesLate = Number(part('hour')) * 60 + Number(part('minute')) - reminder.hour * 60 - reminder.minute;
          if (minutesLate < 0 || minutesLate >= 15) continue;
          const day = `${part('year')}-${part('month')}-${part('day')}`;
          await this.addOnce(String(record.userId), `reminder:${day}`, { icon: 'bell', title: 'Daily check-in', subtitle: '', body: 'Review your workout, meals and daily goals in PhysiqueQuest.', time: 'now', group: 'Today', unread: true });
        } catch { this.logger.warn('Could not create a daily reminder'); }
      }
    } catch { this.logger.warn('Reminder worker unavailable'); }
    finally { this.running = false; }
  }
  async add(userId: string, item: Omit<Notifications['items'][number], 'id'>) {
    const id = randomUUID();
    const saved = await this.model.findOneAndUpdate({ userId: new Types.ObjectId(userId) }, { $setOnInsert: { userId: new Types.ObjectId(userId) }, $push: { items: { ...item, id, createdAt: new Date() } } }, { upsert: true, returnDocument: 'after' });
    if (this.push) await this.push.enqueue(userId, id).catch(() => this.logger.warn({ event: 'push_enqueue_failed' }));
    return saved;
  }
  async addOnce(userId: string, id: string, item: Omit<Notifications['items'][number], 'id'>) {
    await this.get(userId);
    const result = await this.model.updateOne({ userId: new Types.ObjectId(userId), 'items.id': { $ne: id } }, { $push: { items: { ...item, id, createdAt: new Date() } } });
    if (result.modifiedCount && this.push) await this.push.enqueue(userId, id).catch(() => this.logger.warn({ event: 'push_enqueue_failed' }));
  }
}
