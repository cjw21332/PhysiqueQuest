import { Module } from '@nestjs/common';
import { PoseController } from './pose.controller.js';
import { PoseService } from './pose.service.js';
import { PoseAnalysisProvider } from '../providers/pose-analysis.provider.js';
import { VideoReviewService } from './video-review.service.js';
import { AiRateLimitGuard } from '../common/ai-rate-limit.guard.js';
@Module({ controllers: [PoseController], providers: [PoseService, PoseAnalysisProvider, VideoReviewService, AiRateLimitGuard] })
export class PoseModule {}
