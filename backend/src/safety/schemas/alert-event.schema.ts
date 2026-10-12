import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export type AlertEventType = 'manual' | 'inactivity' | 'cancelled';
export type AlertStatus = 'pending' | 'delivered' | 'failed' | 'cancelled';

@Schema({ _id: false })
export class AlertLocation {
  @Prop({ required: true }) lat: number;
  @Prop({ required: true }) lng: number;
  @Prop({ required: true }) accuracyMeters: number;
  @Prop({ required: true }) capturedAt: Date;
}
export const AlertLocationSchema = SchemaFactory.createForClass(AlertLocation);

@Schema({ timestamps: true, collection: 'safety_alert_events' })
export class AlertEvent {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  @Prop({ required: true }) idempotencyKey: string;
  @Prop({ type: String, enum: ['manual', 'inactivity', 'cancelled'], required: true }) eventType: AlertEventType;
  @Prop({ type: String, enum: ['pending', 'delivered', 'failed', 'cancelled'], required: true }) status: AlertStatus;
  @Prop() errorCode?: string;
  @Prop() providerReference?: string;
  @Prop() occurredAt: Date;
  @Prop({ type: AlertLocationSchema, default: undefined }) location?: AlertLocation;
  @Prop({ type: MongooseSchema.Types.ObjectId, default: undefined }) workoutSessionId?: Types.ObjectId;
  @Prop() exerciseId?: string;
  @Prop({ type: Date, default: undefined }) resolvedAt?: Date;
  @Prop({ default: false }) flagged: boolean;
}
export const AlertEventSchema = SchemaFactory.createForClass(AlertEvent);
AlertEventSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
AlertEventSchema.index({ userId: 1, createdAt: -1 });
