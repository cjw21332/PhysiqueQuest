import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

/** In-app feedback about PhysiqueQuest itself (not a workout). Export and account purge cover it by userId. */
@Schema({ timestamps: true, collection: 'app_feedback' })
export class AppFeedback {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, min: 1, max: 5 }) rating: number;
  @Prop({ required: true, enum: ['bug', 'idea', 'praise', 'other'] }) category: string;
  @Prop({ required: true, maxlength: 1000 }) message: string;
  @Prop({ maxlength: 40 }) appVersion?: string;
  @Prop({ maxlength: 20 }) platform?: string;
}

export const AppFeedbackSchema = SchemaFactory.createForClass(AppFeedback);
AppFeedbackSchema.index({ createdAt: -1 });
