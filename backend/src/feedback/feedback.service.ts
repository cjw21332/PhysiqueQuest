import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccountLifecycleFence } from '../privacy/account-lifecycle-fence.js';
import { transformFeedbackHealth } from '../privacy/health-encryption.js';
import { CreateAppFeedbackDto, CreateFeedbackDto } from './dto/feedback.dto.js';
import { AppFeedback } from './schemas/app-feedback.schema.js';
import { WorkoutFeedback } from './schemas/workout-feedback.schema.js';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(WorkoutFeedback.name) private readonly model: Model<WorkoutFeedback>,
    @InjectModel(AppFeedback.name) private readonly appModel?: Model<AppFeedback>,
  ) {}

  async createApp(userId: string, dto: CreateAppFeedbackDto) {
    const record = { userId: new Types.ObjectId(userId), rating: dto.rating, category: dto.category, message: dto.message, ...(dto.appVersion && { appVersion: dto.appVersion }), ...(dto.platform && { platform: dto.platform }) };
    const saved = await new AccountLifecycleFence(this.appModel!.db).withActiveWrite(userId, async session => (await this.appModel!.create([record], { session }))[0]);
    return { id: String(saved._id), saved: true as const };
  }

  async create(userId: string, dto: CreateFeedbackDto) {
    const owner = new Types.ObjectId(userId);
    const painLocations = [...new Set((dto.painLocations ?? []).map(value => value.trim()).filter(Boolean))];
    const notes = dto.notes?.trim() || undefined;
    const sessionRef = dto.sessionRef?.trim() || undefined;
    // Pain locations and notes are health data: encrypt before they reach the database.
    const record = transformFeedbackHealth({ userId: owner, source: dto.source, exercise: dto.exercise, rpe: dto.rpe, difficulty: dto.difficulty, painLocations, ...(dto.enjoyment !== undefined && { enjoyment: dto.enjoyment }), ...(notes && { notes }), ...(sessionRef && { sessionRef }) }, true);
    const saved = await new AccountLifecycleFence(this.model.db).withActiveWrite(userId, async session => {
      if (!sessionRef) return (await this.model.create([record], { session }))[0].toObject();
      // Re-submitting feedback for the same exercise in the same session replaces
      // the earlier answer instead of double-counting it in Coach adaptation.
      const unset = { ...(dto.enjoyment === undefined && { enjoyment: '' }), ...(!notes && { notes: '' }) };
      return this.model.findOneAndUpdate(
        { userId: owner, sessionRef, exercise: dto.exercise },
        { $set: record, ...(Object.keys(unset).length && { $unset: unset }) },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
      ).session(session).lean().exec();
    });
    // Never echo ciphertext or private notes back to the client.
    return { id: String(saved!._id), exercise: dto.exercise, saved: true as const };
  }

  async list(userId: string, limit?: number) {
    const take = Math.min(Math.max(Math.trunc(Number(limit)) || 20, 1), 50);
    const rows = await this.model.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(take).lean();
    return rows.map(row => transformFeedbackHealth(row as Record<string, any>, false) as typeof row);
  }
}
