import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Notifications } from './schemas/notification.schema.js';
import { PushService } from '../push/push.service.js';
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(@InjectModel(Notifications.name) private readonly model: Model<Notifications>, @Optional() private readonly push?: PushService) {}
  async get(userId: string) { return this.model.findOneAndUpdate({ userId: new Types.ObjectId(userId) }, { $setOnInsert: { userId: new Types.ObjectId(userId), items: [] } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }); }
  async mark(userId: string, id: string, unread: boolean) { const current = await this.get(userId); const item = current.items.find(entry => entry.id === id); if (!item) throw new NotFoundException('Notification not found'); item.unread = unread; return current.save(); }
  async markAll(userId: string) { const current = await this.get(userId); current.items.forEach(item => { item.unread = false; }); return current.save(); }
  async add(userId: string, item: Omit<Notifications['items'][number], 'id'>) {
    const id = randomUUID();
    const saved = await this.model.findOneAndUpdate({ userId: new Types.ObjectId(userId) }, { $setOnInsert: { userId: new Types.ObjectId(userId) }, $push: { items: { ...item, id } } }, { upsert: true, returnDocument: 'after' });
    if (this.push) await this.push.enqueue(userId, id).catch(() => this.logger.warn({ event: 'push_enqueue_failed' }));
    return saved;
  }
}
