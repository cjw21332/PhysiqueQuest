import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExerciseRecord, ExerciseRecordSchema } from './schemas/exercise.schema.js';
import { ExerciseLibraryService } from './exercise-library.service.js';
import { ExerciseLibraryController } from './exercise-library.controller.js';
import { ConfigModule } from '@nestjs/config';
import { WgerService } from './wger.service.js';

@Module({
  imports: [ConfigModule, MongooseModule.forFeature([{ name: ExerciseRecord.name, schema: ExerciseRecordSchema }])],
  controllers: [ExerciseLibraryController],
  providers: [ExerciseLibraryService, WgerService],
  exports: [ExerciseLibraryService],
})
export class ExerciseLibraryModule {}
