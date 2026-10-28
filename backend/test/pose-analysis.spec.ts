import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PoseService } from '../src/pose/pose.service.js';
import type { PoseAnalysisDto } from '../src/pose/dto/pose-analysis.dto.js';
const video = () => {
  const ftyp = Buffer.from('\0\0\0\x10ftypisom\0\0\0\0');
  const metadata = Buffer.alloc(20); metadata.writeUInt32BE(1000, 12); metadata.writeUInt32BE(10000, 16);
  const mvhd = Buffer.alloc(8); mvhd.writeUInt32BE(28); mvhd.write('mvhd', 4);
  const moov = Buffer.alloc(8); moov.writeUInt32BE(36); moov.write('moov', 4);
  return Buffer.concat([ftyp, moov, mvhd, metadata]).toString('base64');
};

describe('pose analysis availability', () => {
  it('reports provider setup state and returns a typed unavailable error', async () => {
    const service = new PoseService({ isAvailable: () => false, analyze: vi.fn() } as any);
    expect(service.status()).toEqual({ available: false, reason: 'provider_not_configured' });
    await expect(service.analyze({ mediaBase64: 'AAAA', mimeType: 'video/mp4', durationSeconds: 10 })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns provider analysis only after confirmed upstream response', async () => {
    const analysis = { exercise: 'squat', observations: ['Keep knees aligned'] };
    const provider = { isAvailable: () => true, analyze: vi.fn(async () => analysis) };
    expect(await new PoseService(provider as any).analyze({ mediaBase64: video(), mimeType: 'video/mp4', durationSeconds: 10 })).toEqual(analysis);
  });

  it('reviews sampled frames without exposing them or the joint timeline to the client', async () => {
    const provider = { isAvailable: () => true, analyze: vi.fn(async () => ({ observations: ['tracked'], _reviewFrames: [{ jpeg: 'private' }], _timeline: [{ timeSeconds: 0 }] })) };
    const review = { review: vi.fn(async () => ({ exercise: 'Bench press' })) };
    const result = await new PoseService(provider as any, review as any).analyze({ mediaBase64: video(), mimeType: 'video/mp4', analysisType: 'workout' });
    expect(result).toEqual({ observations: ['tracked'], exerciseReview: { exercise: 'Bench press' } });
    expect(review.review).toHaveBeenCalledOnce();
  });

  it('keeps pose results when the AI review is unavailable', async () => {
    const provider = { isAvailable: () => true, analyze: vi.fn(async () => ({ observations: ['tracked'], _reviewFrames: [], _timeline: [] })) };
    const result = await new PoseService(provider as any, { review: async () => null } as any).analyze({ mediaBase64: video(), mimeType: 'video/mp4' });
    expect(result).toEqual({ observations: ['tracked'], exerciseReview: null });
  });

  it('passes the readiness analysis type through to the configured provider', async () => {
    const provider = { isAvailable: () => true, analyze: vi.fn(async () => ({ fullBodyInFrame: true })) };
    const request: PoseAnalysisDto = {
      mediaBase64: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]).toString('base64'),
      mimeType: 'image/jpeg',
      analysisType: 'readiness',
      requestedChecks: ['fullBodyInFrame', 'lighting', 'distance'],
    };
    await new PoseService(provider as any).analyze(request);
    expect(provider.analyze).toHaveBeenCalledWith(request);
  });
  it('rejects spoofed media before contacting the provider', async () => {
    const provider = { isAvailable: () => true, analyze: vi.fn() };
    await expect(new PoseService(provider as any).analyze({ mediaBase64: 'AAAA', mimeType: 'video/mp4' })).rejects.toThrow('Media bytes');
    expect(provider.analyze).not.toHaveBeenCalled();
  });
  it('rejects an overlong video even if the caller reports a shorter duration', async () => {
    const bytes = Buffer.from(video(), 'base64'); bytes.writeUInt32BE(121000, bytes.length - 4);
    const provider = { isAvailable: () => true, analyze: vi.fn() };
    await expect(new PoseService(provider as any).analyze({ mediaBase64: bytes.toString('base64'), mimeType: 'video/mp4', durationSeconds: 10 })).rejects.toThrow('no longer than 2 minutes');
    expect(provider.analyze).not.toHaveBeenCalled();
  });
});
