import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CompleteWorkoutDto, CreateWorkoutDto, PauseWorkoutDto } from './dto/workout.dto.js';
import { WorkoutSession } from './schemas/workout-session.schema.js';

@Injectable()
export class WorkoutsService {
  constructor(@InjectModel(WorkoutSession.name) private readonly model: Model<WorkoutSession>) {}

  async create(userId: string, dto: CreateWorkoutDto) {
    const startedAt = new Date(dto.startedAt);
    if (startedAt.getTime() > Date.now() + 60_000) throw new BadRequestException('Workout start time cannot be in the future');
    return this.model.create({ userId: new Types.ObjectId(userId), exerciseIds: dto.exerciseIds, startedAt, status: 'active', pausedSeconds: 0, exerciseResults: [] });
  }

  async list(userId: string, limit = 20) {
    return this.model.find({ userId: new Types.ObjectId(userId) }).sort({ startedAt: -1 }).limit(Math.min(Math.max(limit, 1), 100));
  }

  private async owned(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Workout not found');
    const workout = await this.model.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) }).exec();
    if (!workout) throw new NotFoundException('Workout not found');
    return workout;
  }

  async setPaused(userId: string, id: string, dto: PauseWorkoutDto) {
    const workout = await this.owned(userId, id);
    if (workout.status !== 'active') throw new BadRequestException('Completed workouts cannot be paused');
    const occurredAt = new Date(dto.occurredAt);
    if (occurredAt < workout.startedAt || occurredAt.getTime() > Date.now() + 60_000) throw new BadRequestException('Pause time must be within the active workout');
    if (dto.paused) {
      if (workout.pausedAt) return workout;
      workout.pausedAt = occurredAt;
    } else if (workout.pausedAt) {
      workout.pausedSeconds += Math.max(0, Math.floor((occurredAt.getTime() - workout.pausedAt.getTime()) / 1000));
      workout.pausedAt = undefined;
    }
    return workout.save();
  }

  async complete(userId: string, id: string, dto: CompleteWorkoutDto) {
    const workout = await this.owned(userId, id);
    if (workout.status === 'completed') return workout;
    const endedAt = new Date(dto.endedAt);
    if (endedAt < workout.startedAt || endedAt.getTime() > Date.now() + 60_000) throw new BadRequestException('End time must be within the workout');
    const elapsed = Math.max(0, Math.floor((endedAt.getTime() - workout.startedAt.getTime()) / 1000) - workout.pausedSeconds - (workout.pausedAt ? Math.floor((endedAt.getTime() - workout.pausedAt.getTime()) / 1000) : 0));
    workout.endedAt = endedAt;
    workout.durationSeconds = elapsed;
    workout.exerciseResults = dto.exerciseResults;
    workout.status = 'completed';
    return workout.save();
  }
}
