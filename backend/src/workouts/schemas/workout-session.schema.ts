import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ _id: false })
export class ExerciseResult {
  @Prop({ required: true }) exerciseId: string;
  @Prop({ required: true, min: 0 }) reps: number;
  @Prop({ min: 0 }) loadKg?: number;
}

@Schema({ timestamps: true, collection: 'workout_sessions' })
export class WorkoutSession {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ type: [String], required: true }) exerciseIds: string[];
  @Prop({ type: Date, required: true }) startedAt: Date;
  @Prop({ type: Date }) endedAt?: Date;
  @Prop({ type: Date }) pausedAt?: Date;
  @Prop({ default: 0, min: 0 }) pausedSeconds: number;
  @Prop({ enum: ['active', 'completed'], default: 'active' }) status: 'active' | 'completed';
  @Prop({ min: 0 }) durationSeconds?: number;
  @Prop({ type: [ExerciseResult], default: [] }) exerciseResults: ExerciseResult[];
}
export const WorkoutSessionSchema = SchemaFactory.createForClass(WorkoutSession);
