import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfileModule } from '../profile/profile.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AlertDeliveryProvider } from '../providers/alert-delivery.provider.js';
import { SafetyController } from './safety.controller.js';
import { SafetyService } from './safety.service.js';
import { AlertEvent, AlertEventSchema } from './schemas/alert-event.schema.js';
import { WorkoutsModule } from '../workouts/workouts.module.js';
@Module({ imports: [MongooseModule.forFeature([{ name: AlertEvent.name, schema: AlertEventSchema }]), ProfileModule, NotificationsModule, WorkoutsModule], controllers: [SafetyController], providers: [SafetyService, AlertDeliveryProvider] })
export class SafetyModule {}
