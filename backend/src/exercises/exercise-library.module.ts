import { Module } from '@nestjs/common';
import { ExerciseDbModule } from './exercisedb.module.js';
import { ExerciseLibraryService } from './exercise-library.service.js';
import { ExerciseLibraryController } from './exercise-library.controller.js';

@Module({
  imports: [ExerciseDbModule],
  controllers: [ExerciseLibraryController],
  providers: [ExerciseLibraryService],
  exports: [ExerciseLibraryService],
})
export class ExerciseLibraryModule {}
