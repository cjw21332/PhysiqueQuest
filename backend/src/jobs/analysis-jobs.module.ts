import { Module } from '@nestjs/common';
import { FoodScanModule } from '../foodscan/foodscan.module.js';
import { AnalysisJobsController } from './analysis-jobs.controller.js';
import { AnalysisJobsService } from './analysis-jobs.service.js';
@Module({ imports: [FoodScanModule], controllers: [AnalysisJobsController], providers: [AnalysisJobsService] })
export class AnalysisJobsModule {}
