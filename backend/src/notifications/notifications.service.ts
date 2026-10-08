import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Notifications } from './schemas/notification.schema.js';
@Injectable()
export class NotificationsService {
  constructor(@InjectModel(Notifications.name) private readonly model: Model<Notifications>) {}
  async get(userId: string) { return this.model.findOneAndUpdate({ userId: new Types.ObjectId(userId) }, { $setOnInsert: { userId: new Types.ObjectId(userId), items: [] } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }); }
  async mark(userId: string, id: string, unread: boolean) { const current = await this.get(userId); const item = current.items.find(entry => entry.id === id); if (!item) throw new NotFoundException('Notification not found'); item.unread = unread; return current.save(); }
  async markAll(userId: string) { const current = await this.get(userId); current.items.forEach(item => { item.unread = false; }); return current.save(); }
  async add(userId: string, item: Omit<Notifications['items'][number], 'id'>) { const current = await this.get(userId); current.items.push({ ...item, id: randomUUID() } as Notifications['items'][number]); return current.save(); }
}
