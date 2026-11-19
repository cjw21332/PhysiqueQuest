import { describe, expect, it, vi } from 'vitest';
import { analyzeRequestSchema } from './foodscan.schemas.js';
import { OpenAIVisionService } from './services/openai-vision.service.js';
import { openAIResponse } from '../common/openai.js';

vi.mock('../common/openai.js', async importOriginal => ({ ...await importOriginal<typeof import('../common/openai.js')>(), openAIResponse: vi.fn() }));
describe('optional meal description', () => {
  it('accepts image-only and described requests and rejects invalid descriptions', () => {
    expect(analyzeRequestSchema.safeParse({ image: 'test' }).success).toBe(true);
    expect(analyzeRequestSchema.safeParse({ image: 'test', description: '150g chicken' }).success).toBe(true);
    expect(analyzeRequestSchema.safeParse({ image: 'test', description: 42 }).success).toBe(false);
    expect(analyzeRequestSchema.safeParse({ image: 'test', description: 'a'.repeat(2001) }).success).toBe(false);
  });
  it('includes untrusted description and photo in the same model request', async () => {
    vi.mocked(openAIResponse).mockResolvedValue({ content: '{"items":[]}', usage: undefined });
    const service = new OpenAIVisionService({ value: { upstreamTimeoutMs: 5000, maxDetectedItems: 12 } } as never);
    await service.detectFoods('test', 'image/jpeg', undefined, '150g chicken with oil');
    const input = JSON.stringify(vi.mocked(openAIResponse).mock.lastCall?.[0]);
    expect(input).toContain('150g chicken with oil');
    expect(input).toContain('Untrusted user-provided food description');
    expect(input).toContain('data:image/jpeg;base64,test');
    expect(openAIResponse).toHaveBeenCalledTimes(1);
  });
});
