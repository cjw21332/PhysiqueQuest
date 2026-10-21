import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ default: 0, min: 0 })
  sessionVersion: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;

  @Prop({ type: Date, default: null, index: true })
  purgeAfter: Date | null;

  @Prop({ type: Date, default: null })
  purgingAt: Date | null;

  @Prop({ enum: ['user', 'admin'], default: 'user', required: true })
  role: 'user' | 'admin';

  @Prop({ default: false }) emailVerified: boolean;
  @Prop({ type: Date, default: null }) emailVerifiedAt: Date | null;
  @Prop({ default: 1 }) authPolicyVersion: number;
  @Prop({ type: Boolean }) legacyEmailAccess?: boolean;

  @Prop({ default: 0, min: 0 })
  failedLoginAttempts: number;

  @Prop({ type: Date, default: null })
  lockoutUntil: Date | null;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
