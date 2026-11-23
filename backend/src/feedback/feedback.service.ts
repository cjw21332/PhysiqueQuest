import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateFeedbackDto } from './dto/feedback.dto.js';
import { WorkoutFeedback } from './schemas/workout-feedback.schema.js';

@Injectable()
export class FeedbackService {
  constructor(@InjectModel(WorkoutFeedback.name) private readonly model: Model<WorkoutFeedback>) {}

  async create(userId: string, dto: CreateFeedbackDto) {
    const doc = await this.model.create({ ...dto, userId: new Types.ObjectId(userId) });
    return doc.toObject();
  }

  list(userId: string, limit?: number) {
    const take = Math.min(Math.max(Math.trunc(Number(limit)) || 20, 1), 50);
    return this.model.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(take).lean();
  }
}
