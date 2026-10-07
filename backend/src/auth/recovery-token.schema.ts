import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'password_recovery_tokens' })
export class RecoveryToken {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, unique: true, select: false }) tokenHash: string;
  @Prop({ required: true, expires: 0 }) expiresAt: Date;
  @Prop({ type: Date, default: null }) usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export const RecoveryTokenSchema = SchemaFactory.createForClass(RecoveryToken);
