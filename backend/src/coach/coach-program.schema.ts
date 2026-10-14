import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'coach_programs' })
export class CoachProgram {
  @Prop({ type: MongoSchema.Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  contextHash: string;

  @Prop({ type: MongoSchema.Types.Mixed, required: true })
  plan: Record<string, any>;

  createdAt?: Date;
}
export const CoachProgramSchema = SchemaFactory.createForClass(CoachProgram);
CoachProgramSchema.index({ userId: 1, contextHash: 1 }, { unique: true });
