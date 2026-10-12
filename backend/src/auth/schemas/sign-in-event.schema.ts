import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';

export type SignInEventDocument = HydratedDocument<SignInEvent>;

@Schema({ timestamps: true, collection: 'sign_in_events' })
export class SignInEvent {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  occurredAt: Date;

  @Prop({ enum: ['login', 'register'], required: true })
  source: 'login' | 'register';
}

export const SignInEventSchema = SchemaFactory.createForClass(SignInEvent);
SignInEventSchema.index({ userId: 1, occurredAt: -1 });
SignInEventSchema.index({ occurredAt: 1 });
