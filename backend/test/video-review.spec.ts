import { describe, expect, it, vi } from 'vitest';
import { VideoReviewService } from '../src/pose/video-review.service.js';

const generateContent = vi.hoisted(() => vi.fn());
const usedKeys = vi.hoisted(() => [] as string[]);
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent }; constructor(options: { apiKey: string }) { usedKeys.push(options.apiKey); } } }));
const frames = [{ jpeg: 'YWJj', timeSeconds: 0 }, { jpeg: 'ZGVm', timeSeconds: 1 }];

describe('video exercise review', () => {
  it('bounds and validates AI output', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ exercise: 'Squat', equipment: 'Machine', estimatedReps: 5, formObservations: ['Review knee alignment'], instructions: ['Move under control'], corrections: [] }) });
    const service = new VideoReviewService({ get: () => 'key' } as any);
    expect(await service.review(frames, [])).toMatchObject({ exercise: 'Squat', equipment: 'Machine', estimatedReps: 5, formObservations: ['Review knee alignment'] });
  });
  it('returns unavailable for invalid samples or an AI failure', async () => {
    const service = new VideoReviewService({ get: () => 'key' } as any);
    expect(await service.review([], [])).toBeNull();
    generateContent.mockRejectedValueOnce(new Error('unavailable'));
    expect(await service.review(frames, [])).toBeNull();
  });
  it('retries a transient provider failure before giving up', async () => {
    generateContent.mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce({ text: JSON.stringify({ exercise: 'Chest press', equipment: 'Machine', estimatedReps: 3 }) });
    const service = new VideoReviewService({ get: () => 'key' } as any);
    expect(await service.review(frames, [])).toMatchObject({ exercise: 'Chest press', estimatedReps: 3 });
  });
  it('accepts common variations in equipment case and muscle lists', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ equipment: 'machine', specificMuscles: ['Chest', 'Triceps'] }) });
    expect(await new VideoReviewService({ get: () => 'key' } as any).review(frames, [])).toMatchObject({ equipment: 'Machine', specificMuscles: 'Chest, Triceps' });
  });
  it('tries the secondary key after an authentication or transient provider failure', async () => {
    usedKeys.length = 0;
    generateContent.mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce({ text: JSON.stringify({ exercise: 'Squat' }) });
    const service = new VideoReviewService({ get: (name: string) => name === 'GEMINI_API_KEY' ? 'primary' : name === 'GEMINI_API_KEY_SECONDARY' ? 'secondary' : undefined } as any);
    expect(await service.review(frames, [])).toMatchObject({ exercise: 'Squat' });
    expect(usedKeys).toEqual(['primary', 'secondary']);
  });
});
