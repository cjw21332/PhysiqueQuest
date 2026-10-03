import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
@Schema({ _id: false })
export class NotificationItem { @Prop({ required: true }) id: string; @Prop({ required: true }) icon: string; @Prop({ required: true }) title: string; @Prop({ default: '' }) subtitle: string; @Prop({ required: true }) body: string; @Prop({ required: true }) time: string; @Prop({ required: true }) group: string; @Prop({ default: true }) unread: boolean; }
@Schema({ timestamps: true, collection: 'notifications' })
export class Notifications { @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true }) userId: Types.ObjectId; @Prop({ type: [NotificationItem], default: [] }) items: NotificationItem[]; }
export const NotificationsSchema = SchemaFactory.createForClass(Notifications);
