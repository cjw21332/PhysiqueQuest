import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'settings' })
export class Settings {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  values: Record<string, unknown>;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
