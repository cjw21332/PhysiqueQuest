import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesGuard } from '../auth/roles.guard.js';
import { User, UserSchema } from '../auth/schemas/user.schema.js';
import { WorkoutSession, WorkoutSessionSchema } from '../workouts/schemas/workout-session.schema.js';
import { AlertEvent, AlertEventSchema } from '../safety/schemas/alert-event.schema.js';
import { AdminAnalyticsController } from './admin-analytics.controller.js';
import { AdminAnalyticsService } from './admin-analytics.service.js';
import { AdminAlertsController } from './admin-alerts.controller.js';
import { AdminAlertsService } from './admin-alerts.service.js';
@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }, { name: WorkoutSession.name, schema: WorkoutSessionSchema }, { name: AlertEvent.name, schema: AlertEventSchema }])],
  controllers: [AdminAnalyticsController, AdminAlertsController],
  providers: [AdminAnalyticsService, AdminAlertsService, RolesGuard],
})
export class AdminModule {}
