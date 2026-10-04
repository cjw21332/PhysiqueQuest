import { Module } from '@nestjs/common';
import { PoseController } from './pose.controller.js';
import { PoseService } from './pose.service.js';
import { PoseAnalysisProvider } from '../providers/pose-analysis.provider.js';
@Module({ controllers: [PoseController], providers: [PoseService, PoseAnalysisProvider] })
export class PoseModule {}
