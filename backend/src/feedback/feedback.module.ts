import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FeedbackController } from './feedback.controller.js';
import { FeedbackService } from './feedback.service.js';
import { EmailDeliveryProvider } from '../providers/email-delivery.provider.js';
import { WorkoutFeedback, WorkoutFeedbackSchema } from './schemas/workout-feedback.schema.js';
import { AppFeedback, AppFeedbackSchema } from './schemas/app-feedback.schema.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: WorkoutFeedback.name, schema: WorkoutFeedbackSchema }, { name: AppFeedback.name, schema: AppFeedbackSchema }])],
  controllers: [FeedbackController],
  providers: [FeedbackService, EmailDeliveryProvider],
  exports: [FeedbackService],
})
export class FeedbackModule {}
