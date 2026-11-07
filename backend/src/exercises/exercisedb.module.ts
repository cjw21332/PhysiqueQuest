import { Module } from '@nestjs/common';
import { ExerciseDbService } from './exercisedb.service.js';
import { CatalogSyncService } from './catalog-sync.service.js';
@Module({ providers: [ExerciseDbService, CatalogSyncService], exports: [ExerciseDbService, CatalogSyncService] })
export class ExerciseDbModule {}
