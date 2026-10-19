import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateSettingsDto } from './dto/settings.dto.js';
import { Settings } from './schemas/settings.schema.js';

@Injectable()
export class SettingsService {
  constructor(@InjectModel(Settings.name) private readonly model: Model<Settings>) {}

  async get(userId: string) {
    return await this.model.findOne({ userId: new Types.ObjectId(userId) }).exec() ?? { values: {} };
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    const patch = Object.fromEntries(Object.entries(dto.values).map(([key, value]) => [`values.${key}`, value]));
    return this.model.findOneAndUpdate({ userId: new Types.ObjectId(userId) }, { $set: patch }, { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true });
  }
}
