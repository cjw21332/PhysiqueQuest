import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'push_devices' })
export class PushDevice {
  @Prop({ type: MongoSchema.Types.ObjectId, required: true }) userId: Types.ObjectId;
  @Prop({ required: true }) deviceId: string;
  @Prop({ required: true, select: false }) token: string;
  @Prop({ type: MongoSchema.Types.ObjectId, required: true }) version: Types.ObjectId;
}
export const PushDeviceSchema = SchemaFactory.createForClass(PushDevice);
PushDeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
PushDeviceSchema.index({ token: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'push_deliveries' })
export class PushDelivery {
  @Prop({ type: MongoSchema.Types.ObjectId, required: true }) userId: Types.ObjectId;
  @Prop({ type: MongoSchema.Types.ObjectId, required: true }) deviceId: Types.ObjectId;
  @Prop({ type: MongoSchema.Types.ObjectId, required: true }) deviceVersion: Types.ObjectId;
  @Prop({ required: true }) notificationId: string;
  @Prop({ default: 'pending' }) status: string;
  @Prop({ default: 0 }) attempts: number;
  @Prop({ default: Date.now }) runAt: Date;
  @Prop() receiptId?: string;
  @Prop() expiresAt?: Date;
  @Prop() outcome?: string;
}
export const PushDeliverySchema = SchemaFactory.createForClass(PushDelivery);
PushDeliverySchema.index({ notificationId: 1, deviceId: 1 }, { unique: true });
PushDeliverySchema.index({ status: 1, runAt: 1 });
PushDeliverySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
