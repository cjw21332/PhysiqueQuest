import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkoutsController } from './workouts.controller.js';
import { WorkoutsService } from './workouts.service.js';
import { WorkoutSession, WorkoutSessionSchema } from './schemas/workout-session.schema.js';
@Module({ imports: [MongooseModule.forFeature([{ name: WorkoutSession.name, schema: WorkoutSessionSchema }])], controllers: [WorkoutsController], providers: [WorkoutsService], exports: [WorkoutsService] })
export class WorkoutsModule {}
