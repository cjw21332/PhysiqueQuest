import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { Notifications, NotificationsSchema } from './schemas/notification.schema.js';
@Module({ imports: [MongooseModule.forFeature([{ name: Notifications.name, schema: NotificationsSchema }])], controllers: [NotificationsController], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
