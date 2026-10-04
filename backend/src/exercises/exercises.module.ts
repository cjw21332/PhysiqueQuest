import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesGuard } from '../auth/roles.guard.js';
import { AdminExercisesController } from './exercises.controller.js';
import { AdminExercisesService } from './exercises.service.js';
import { ExerciseRecord, ExerciseRecordSchema } from './schemas/exercise.schema.js';
@Module({ imports: [MongooseModule.forFeature([{ name: ExerciseRecord.name, schema: ExerciseRecordSchema }])], controllers: [AdminExercisesController], providers: [AdminExercisesService, RolesGuard] })
export class ExercisesModule {}
