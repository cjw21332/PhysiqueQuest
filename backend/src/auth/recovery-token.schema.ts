import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'password_recovery_tokens' })
export class RecoveryToken {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, unique: true, select: false }) tokenHash: string;
  @Prop() requestId?: string;
  @Prop({ enum: ['password-reset', 'password-change'], default: 'password-reset' }) purpose: string;
  @Prop() accountEmail?: string;
  @Prop() sessionVersion?: number;
  @Prop({ default: 0 }) attempts: number;
  @Prop({ type: Date, default: null }) verifiedAt: Date | null;
  @Prop({ select: false }) grantHash?: string;
  @Prop({ type: Date }) grantExpiresAt?: Date;
  @Prop({ required: true, expires: 0 }) expiresAt: Date;
  @Prop({ type: Date, default: null }) usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export const RecoveryTokenSchema = SchemaFactory.createForClass(RecoveryToken);
RecoveryTokenSchema.index({ requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } });
RecoveryTokenSchema.index({ grantHash: 1 }, { unique: true, partialFilterExpression: { grantHash: { $type: 'string' } } });
