import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'admin_exercises' })
export class ExerciseRecord {
  _id: Types.ObjectId;
  @Prop({ required: true, trim: true, maxlength: 80 }) name: string;
  @Prop({ trim: true, default: '' }) slug: string;
  @Prop({ default: 'General', trim: true, maxlength: 100 }) group: string;
  @Prop({ enum: ['draft', 'published'], default: 'draft' }) status: 'draft' | 'published';
  @Prop({ enum: ['missing', 'ready', 'training'], default: 'missing' }) pose: 'missing' | 'ready' | 'training';

  // Dynamic library fields (from task spec — mapped to existing MongoDB)
  @Prop({ trim: true, default: '' }) targetMuscle: string;
  @Prop({ trim: true, default: '' }) equipment: string;
  @Prop({ trim: true, default: 'Beginner' }) difficulty: string;
  @Prop({ trim: true, default: '' }) pictureUrl: string;
  @Prop({ trim: true, default: '' }) videoUrl: string;
  @Prop({ type: [String], default: [] }) instructions: string[];
  @Prop({ trim: true, default: 'Manual' }) trackingStatus: string;
}
export const ExerciseRecordSchema = SchemaFactory.createForClass(ExerciseRecord);
ExerciseRecordSchema.index({ targetMuscle: 1 });
ExerciseRecordSchema.index({ equipment: 1 });
ExerciseRecordSchema.index({ status: 1, pose: 1 });
