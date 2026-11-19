import { describe, expect, it, vi } from 'vitest';
import { VideoReviewService } from './video-review.service.js';
import { openAIResponse } from '../common/openai.js';

vi.mock('../common/openai.js', () => ({ openAIResponse: vi.fn() }));
describe('OpenAI video review', () => {
  it('submits sampled frames and returns bounded observations', async () => {
    vi.mocked(openAIResponse).mockResolvedValueOnce({ content: JSON.stringify({ exercise: 'Squat', equipment: 'Bodyweight', generalBodyPart: 'Legs', specificMuscles: ['Quadriceps'], estimatedReps: null, formObservations: ['Movement is visible'], corrections: [], instructions: [] }), usage: undefined });
    const config = { get: () => 'configured' };
    const result = await new VideoReviewService(config as never).review([{ jpeg: 'YWJj', timeSeconds: 0 }, { jpeg: 'YWJj', timeSeconds: 1 }], []);
    expect(result).toMatchObject({ exercise: 'Squat', equipment: 'Bodyweight', estimatedReps: null });
    expect(JSON.stringify(vi.mocked(openAIResponse).mock.calls[0])).toContain('data:image/jpeg;base64,YWJj');
    expect(vi.mocked(openAIResponse).mock.calls[0][3]).toBe('gpt-6-luna');
  });
  it('does not submit insufficient frames', async () => {
    vi.mocked(openAIResponse).mockClear();
    const service = new VideoReviewService({ get: () => 'configured' } as never);
    expect(await service.review([{ jpeg: 'YWJj', timeSeconds: 0 }], [])).toBeNull();
    expect(openAIResponse).not.toHaveBeenCalled();
  });
});
