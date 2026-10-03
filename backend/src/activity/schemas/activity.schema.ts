import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'activity' })
export class Activity {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true }) userId: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} }) state: Record<string, unknown>;
}
export const ActivitySchema = SchemaFactory.createForClass(Activity);
