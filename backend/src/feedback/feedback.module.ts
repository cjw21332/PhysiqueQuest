import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FeedbackController } from './feedback.controller.js';
import { FeedbackService } from './feedback.service.js';
import { WorkoutFeedback, WorkoutFeedbackSchema } from './schemas/workout-feedback.schema.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: WorkoutFeedback.name, schema: WorkoutFeedbackSchema }])],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
