import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoReviewService } from '../src/pose/video-review.service.js';
import { openAIResponse } from '../src/common/openai.js';

vi.mock('../src/common/openai.js', () => ({ openAIResponse: vi.fn() }));
const frames = [{ jpeg: 'YWJj', timeSeconds: 0 }, { jpeg: 'ZGVm', timeSeconds: 1 }];
const service = () => new VideoReviewService({ get: () => 'configured' } as never);

describe('video exercise review', () => {
  beforeEach(() => vi.resetAllMocks());
  it('validates and bounds provider output', async () => {
    vi.mocked(openAIResponse).mockResolvedValueOnce({ content: JSON.stringify({ exercise: 'Squat', equipment: 'machine', specificMuscles: ['Chest', 'Triceps'], estimatedReps: 5, formObservations: ['Review knee alignment'] }), usage: undefined });
    expect(await service().review(frames, [])).toMatchObject({ exercise: 'Squat', equipment: 'Machine', specificMuscles: 'Chest, Triceps', estimatedReps: 5, formObservations: ['Review knee alignment'] });
  });
  it('does not submit invalid samples or use an unconfigured provider', async () => {
    expect(await service().review([], [])).toBeNull();
    expect(await new VideoReviewService({ get: () => undefined } as never).review(frames, [])).toBeNull();
    expect(openAIResponse).not.toHaveBeenCalled();
  });
  it('returns unavailable on provider failure or malformed output', async () => {
    vi.mocked(openAIResponse).mockRejectedValueOnce(new Error('provider error')).mockResolvedValueOnce({ content: 'not JSON', usage: undefined });
    expect(await service().review(frames, [])).toBeNull();
    expect(await service().review(frames, [])).toBeNull();
  });
});
