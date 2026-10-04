import { Injectable, ServiceUnavailableException, BadGatewayException } from '@nestjs/common';
import { PoseAnalysisProvider } from '../providers/pose-analysis.provider.js';
import { PoseAnalysisDto } from './dto/pose-analysis.dto.js';

@Injectable()
export class PoseService {
  constructor(private readonly provider: PoseAnalysisProvider) {}
  status() { return this.provider.isAvailable() ? { available: true as const } : { available: false as const, reason: 'provider_not_configured' as const }; }
  async analyze(dto: PoseAnalysisDto) {
    if (!this.provider.isAvailable()) throw new ServiceUnavailableException({ code: 'PROVIDER_NOT_CONFIGURED', message: 'Pose analysis is not configured on the backend.' });
    try { return await this.provider.analyze(dto); }
    catch { throw new BadGatewayException({ code: 'POSE_PROVIDER_FAILED', message: 'Pose analysis did not return a usable result. Please retry later.' }); }
  }
}
