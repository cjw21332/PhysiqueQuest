import { Injectable, Optional, ServiceUnavailableException, BadGatewayException, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { PoseAnalysisProvider } from '../providers/pose-analysis.provider.js';
import { PoseAnalysisDto } from './dto/pose-analysis.dto.js';
import { sniffImageMime } from '../foodscan/foodscan.schemas.js';
import { videoDuration } from './video-duration.js';
import { VideoReviewService } from './video-review.service.js';

@Injectable()
export class PoseService {
  constructor(private readonly provider: PoseAnalysisProvider, @Optional() private readonly review?: VideoReviewService) {}
  // Configuration is checked here; a provider outage is reported when analysis is requested.
  status() { return this.provider.isAvailable() ? { available: true as const } : { available: false as const, reason: 'provider_not_configured' as const }; }
  async analyze(dto: PoseAnalysisDto) {
    if (!this.provider.isAvailable()) throw new ServiceUnavailableException({ code: 'PROVIDER_NOT_CONFIGURED', message: 'Pose analysis is not configured on the backend.' });
    const bytes = Buffer.from(dto.mediaBase64, 'base64');
    if (bytes.length > 20 * 1024 * 1024) throw new PayloadTooLargeException('Media is too large');
    const imageType = sniffImageMime(bytes);
    const brand = bytes.subarray(8, 12).toString('ascii');
    const movieType = bytes.length >= 16 && bytes.subarray(4, 8).toString('ascii') === 'ftyp'
      ? brand === 'qt  ' ? 'video/quicktime' : /^(?:isom|iso[2-9]|mp4[12]|avc1|M4V )$/.test(brand) ? 'video/mp4' : null : null;
    if ((imageType ?? movieType) !== dto.mimeType) throw new BadRequestException('Media bytes do not match the declared format');
    if (dto.mimeType.startsWith('video/')) {
      const duration = videoDuration(bytes);
      if (duration === null) throw new BadRequestException('Could not read video duration. Choose a playable MP4 or MOV video.');
      if (duration > 120) throw new BadRequestException('Choose a video no longer than 2 minutes.');
      dto = { ...dto, durationSeconds: Math.ceil(duration) };
    }
    try {
      const analysis = await this.provider.analyze(dto) as Record<string, unknown>;
      const { _reviewFrames, _timeline, ...publicAnalysis } = analysis;
      if (!dto.mimeType.startsWith('video/') || !_reviewFrames) return publicAnalysis;
      const exerciseReview = await this.review?.review(_reviewFrames, _timeline);
      return { ...publicAnalysis, exerciseReview: exerciseReview ?? null };
    }
    catch { throw new BadGatewayException({ code: 'POSE_PROVIDER_FAILED', message: 'Pose analysis did not return a usable result. Please retry later.' }); }
  }
}
