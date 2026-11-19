import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIRequestError, openAIResponse } from '../../common/openai.js';
import { OpenAIVisionService } from './openai-vision.service.js';

vi.mock('../../common/openai.js', async importOriginal => {
  const original = await importOriginal<typeof import('../../common/openai.js')>();
  return { ...original, openAIResponse: vi.fn() };
});

describe('food photo recognition boundary', () => {
  const create = () => new OpenAIVisionService({ value: { upstreamTimeoutMs: 5000, maxDetectedItems: 12 } } as never);
  afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
  it('sends both supported photo types through the configured model', async () => {
    vi.stubEnv('OPENAI_MODEL', 'gpt-6-luna');
    vi.mocked(openAIResponse).mockResolvedValue({ content: '{"items":[]}', usage: undefined });
    for (const mime of ['image/jpeg', 'image/png'] as const) {
      await expect(create().detectFoods('test', mime)).resolves.toEqual([]);
      expect(vi.mocked(openAIResponse).mock.lastCall?.[3]).toBe('gpt-6-luna');
      expect(JSON.stringify(vi.mocked(openAIResponse).mock.lastCall?.[0])).toContain(`data:${mime};base64,`);
      expect(JSON.stringify(vi.mocked(openAIResponse).mock.lastCall?.[0])).toContain('visually distinguishable edible ingredients separately');
      expect(JSON.stringify(vi.mocked(openAIResponse).mock.lastCall?.[0])).toContain('Do not count the same dish and its ingredients twice');
    }
  });
  it('keeps a detected food when its portion description exceeds the display limit', async () => {
    vi.mocked(openAIResponse).mockResolvedValue({ content: JSON.stringify({ items: [{ food_name: 'Rice', est_weight_g: 100, confidence: 0.8, localName: '', searchTerms: [], isComposite: false, portionDescription: 'A'.repeat(180) }] }), usage: undefined });
    const result = await create().detectFoods('test', 'image/jpeg');
    expect(result[0].food_name).toBe('Rice');
    expect(result[0].portionDescription).toHaveLength(120);
    expect(openAIResponse).toHaveBeenCalledTimes(1);
  });
  it('maps a rejected image request to actionable, provider-neutral text', async () => {
    vi.mocked(openAIResponse).mockRejectedValue(new OpenAIRequestError(400));
    await expect(create().detectFoods('test', 'image/jpeg')).rejects.toMatchObject({ code: 'INVALID_REQUEST', message: 'This photo could not be processed. Try a different photo or retake it.' });
  });
  it('retries an incomplete response within the scan budget', async () => {
    vi.mocked(openAIResponse).mockRejectedValueOnce(new Error('Incomplete OpenAI response')).mockResolvedValueOnce({ content: '{"items":[]}', usage: undefined });
    await expect(create().detectFoods('test', 'image/jpeg')).resolves.toEqual([]);
    expect(openAIResponse).toHaveBeenCalledTimes(2);
    expect(vi.mocked(openAIResponse).mock.calls[0][1]).toBe(3000);
  });
  it('does not expose malformed provider output or claim the model is unavailable', async () => {
    vi.mocked(openAIResponse).mockResolvedValue({ content: 'invalid private response', usage: undefined });
    await expect(create().detectFoods('test', 'image/jpeg')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', message: 'Could not analyse this photo right now. Please try again.' });
  });
});
