import { Module } from '@nestjs/common';
import { ExerciseDbService } from './exercisedb.service.js';
@Module({ providers: [ExerciseDbService], exports: [ExerciseDbService] })
export class ExerciseDbModule {}
