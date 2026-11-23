import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';

export type WorkoutFeedbackDocument = HydratedDocument<WorkoutFeedback>;

@Schema({ timestamps: true, collection: 'workout_feedback' })
export class WorkoutFeedback {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, enum: ['pose', 'manual'] }) source: string;
  @Prop({ required: true, maxlength: 100 }) exercise: string;
  @Prop({ maxlength: 100 }) sessionRef?: string;
  @Prop({ required: true, min: 1, max: 10 }) rpe: number;
  @Prop({ required: true, enum: ['too_easy', 'just_right', 'too_hard'] }) difficulty: string;
  @Prop({ min: 1, max: 5 }) enjoyment?: number;
  @Prop({ type: [String], default: [] }) painLocations: string[];
  @Prop({ maxlength: 500 }) notes?: string;
}

export const WorkoutFeedbackSchema = SchemaFactory.createForClass(WorkoutFeedback);
WorkoutFeedbackSchema.index({ userId: 1, createdAt: -1 });
