import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PoseService } from '../src/pose/pose.service.js';
import type { PoseAnalysisDto } from '../src/pose/dto/pose-analysis.dto.js';

describe('pose analysis availability', () => {
  it('reports provider setup state and returns a typed unavailable error', async () => {
    const service = new PoseService({ isAvailable: () => false, analyze: vi.fn() } as any);
    expect(service.status()).toEqual({ available: false, reason: 'provider_not_configured' });
    await expect(service.analyze({ mediaBase64: 'AAAA', mimeType: 'video/mp4', durationSeconds: 10 })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns provider analysis only after confirmed upstream response', async () => {
    const analysis = { exercise: 'squat', observations: ['Keep knees aligned'] };
    const provider = { isAvailable: () => true, analyze: vi.fn(async () => analysis) };
    expect(await new PoseService(provider as any).analyze({ mediaBase64: 'AAAA', mimeType: 'video/mp4', durationSeconds: 10 })).toEqual(analysis);
  });

  it('passes the readiness analysis type through to the configured provider', async () => {
    const provider = { isAvailable: () => true, analyze: vi.fn(async () => ({ fullBodyInFrame: true })) };
    const request: PoseAnalysisDto = {
      mediaBase64: 'AAAA',
      mimeType: 'image/jpeg',
      analysisType: 'readiness',
      requestedChecks: ['fullBodyInFrame', 'lighting', 'distance'],
    };
    await new PoseService(provider as any).analyze(request);
    expect(provider.analyze).toHaveBeenCalledWith(request);
  });
});
