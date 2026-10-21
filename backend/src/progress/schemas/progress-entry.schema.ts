import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'progress_entries' })
export class ProgressEntry {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ enum: ['weight', 'waist', 'benchPress'], required: true }) metric: 'weight' | 'waist' | 'benchPress';
  @Prop({ required: true, min: 0.1, max: 1000 }) value: number;
  @Prop({ enum: ['kg', 'lb', 'cm', 'in'], required: true }) unit: 'kg' | 'lb' | 'cm' | 'in';
  @Prop({ required: true }) measuredAt: Date;
}
export const ProgressEntrySchema = SchemaFactory.createForClass(ProgressEntry);
ProgressEntrySchema.index({ userId: 1, metric: 1, measuredAt: -1 });
ProgressEntrySchema.index({ userId: 1, measuredAt: -1 });
