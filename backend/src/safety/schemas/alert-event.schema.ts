import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'safety_alert_events' })
export class AlertEvent {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  @Prop({ required: true }) idempotencyKey: string;
  @Prop({ enum: ['manual'], required: true }) eventType: 'manual';
  @Prop({ enum: ['pending', 'delivered', 'failed'], required: true }) status: 'pending' | 'delivered' | 'failed';
  @Prop() errorCode?: string;
  @Prop() providerReference?: string;
  @Prop() occurredAt: Date;
}
export const AlertEventSchema = SchemaFactory.createForClass(AlertEvent);
AlertEventSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
