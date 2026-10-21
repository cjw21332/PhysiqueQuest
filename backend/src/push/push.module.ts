import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notifications, NotificationsSchema } from '../notifications/schemas/notification.schema.js';
import { PushController } from './push.controller.js';
import { PushService } from './push.service.js';
import { PushDelivery, PushDeliverySchema, PushDevice, PushDeviceSchema } from './push.schema.js';

@Module({
  imports: [MongooseModule.forFeature([
    { name: PushDevice.name, schema: PushDeviceSchema },
    { name: PushDelivery.name, schema: PushDeliverySchema },
    { name: Notifications.name, schema: NotificationsSchema },
  ])], controllers: [PushController], providers: [PushService], exports: [PushService],
})
export class PushModule {}
