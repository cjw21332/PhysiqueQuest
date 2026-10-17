import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import type { SetResult, WorkoutExercise } from '../workout-contract.js';

@Schema({ _id: false })
export class ExerciseResult {
  @Prop({ required: true }) exerciseId: string;
  @Prop({ required: true, min: 0 }) reps: number;
  @Prop({ min: 0 }) loadKg?: number;
}

@Schema({ timestamps: true, collection: 'workout_sessions' })
export class WorkoutSession {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;
  @Prop({ type: [String], required: true }) exerciseIds: string[];
  @Prop({ type: Date, required: true }) startedAt: Date;
  @Prop({ type: Date }) endedAt?: Date;
  @Prop({ type: Date }) pausedAt?: Date;
  @Prop({ default: 0, min: 0 }) pausedSeconds: number;
  @Prop({ enum: ['active', 'completed'], default: 'active' }) status:
    'active' | 'completed';
  @Prop({ min: 0 }) durationSeconds?: number;
  @Prop({ type: [ExerciseResult], default: [] })
  exerciseResults: ExerciseResult[];
  @Prop({ type: [Object], default: [] }) exercises: WorkoutExercise[];
  @Prop({ type: [Object], default: [] }) sets: SetResult[];
  @Prop({ type: [String], default: [] }) appliedRecordingIds: string[];
  @Prop({ default: 0 }) revision: number;
  @Prop({ enum: ['planned', 'standalone', 'recorded-set'] }) origin?:
    'planned' | 'standalone' | 'recorded-set';
  @Prop() requestKey?: string;
  @Prop() requestHash?: string;
  @Prop() completionHash?: string;
  @Prop() programVersion?: string;
  @Prop() dayIndex?: number;
  @Prop() scheduledDate?: string;
  @Prop() timezone?: string;
  @Prop() activityDate?: string;
  @Prop() creditPolicyVersion?: number;
}
export const WorkoutSessionSchema =
  SchemaFactory.createForClass(WorkoutSession);
WorkoutSessionSchema.index(
  { userId: 1, requestKey: 1 },
  {
    unique: true,
    partialFilterExpression: { requestKey: { $type: 'string' } },
  },
);
WorkoutSessionSchema.index({ userId: 1, status: 1, endedAt: -1 });
WorkoutSessionSchema.index({ status: 1, endedAt: -1 });
WorkoutSessionSchema.index({ userId: 1, startedAt: -1, _id: -1 });
WorkoutSessionSchema.index({ userId: 1, activityDate: 1 });
WorkoutSessionSchema.index({ userId: 1, scheduledDate: 1 });
WorkoutSessionSchema.index(
  { userId: 1, appliedRecordingIds: 1 },
  { unique: true, partialFilterExpression: { appliedRecordingIds: { $type: 'string' } } },
);
