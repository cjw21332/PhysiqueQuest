import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateActivityDto } from './dto/activity.dto.js';
import { Activity } from './schemas/activity.schema.js';

@Injectable()
export class ActivityService {
  constructor(@InjectModel(Activity.name) private readonly model: Model<Activity>) {}
  async get(userId: string) { return this.model.findOneAndUpdate({ userId: new Types.ObjectId(userId) }, { $setOnInsert: { userId: new Types.ObjectId(userId), state: {} } }, { upsert: true, new: true, setDefaultsOnInsert: true }); }
  async update(userId: string, dto: UpdateActivityDto) { const current = await this.get(userId); current.state = { ...current.state, ...dto.state }; return current.save(); }
}
