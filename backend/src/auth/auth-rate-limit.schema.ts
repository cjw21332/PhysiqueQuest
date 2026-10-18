import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'auth_rate_limits', versionKey: false })
export class AuthRateLimit {
  @Prop({ type: String }) _id: string;
  @Prop({ required: true, min: 0 }) hits: number;
  @Prop({ required: true, expires: 0 }) expiresAt: Date;
}
export const AuthRateLimitSchema = SchemaFactory.createForClass(AuthRateLimit);
