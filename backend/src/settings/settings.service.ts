import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateSettingsDto } from './dto/settings.dto.js';
import { Settings } from './schemas/settings.schema.js';

@Injectable()
export class SettingsService {
  constructor(@InjectModel(Settings.name) private readonly model: Model<Settings>) {}

  async get(userId: string) {
    return this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), values: {} } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    const current = await this.get(userId);
    current.values = { ...current.values, ...dto.values };
    return current.save();
  }
}
