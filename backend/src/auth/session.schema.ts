import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'auth_sessions' })
export class AuthSession {
  @Prop({ type: String }) _id: string;
  @Prop({ type: Types.ObjectId, required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true }) sessionVersion: number;
  @Prop({ required: true }) tokenHash: string;
  @Prop({ type: [String], default: [] }) usedHashes: string[];
  @Prop({ required: true }) expiresAt: Date;
  @Prop({ required: true }) purgeAt: Date;
  @Prop({ type: Date, default: null }) revokedAt: Date | null;
  @Prop() lastUsedAt: Date;
}
export const AuthSessionSchema = SchemaFactory.createForClass(AuthSession);
AuthSessionSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
