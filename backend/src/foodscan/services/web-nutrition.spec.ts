import { afterEach, describe, expect, it, vi } from 'vitest';
import { openAIResponse } from '../../common/openai.js';
import { researchNutrition, verifiedWebNutrition } from './web-nutrition.js';

vi.mock('../../common/openai.js', () => ({ OPENAI_MODEL: 'test-model', openAIResponse: vi.fn() }));
describe('web nutrition research', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
  const content = JSON.stringify({ name: 'Cooked beans', url: 'https://example.org/beans', kcal: 47, protein: 3, carbs: 8, fat: 0.2 });
  it('keeps cited values in an account-bound reference and rejects tampering', async () => {
    vi.stubEnv('JWT_SECRET', 'a long test signing secret');
    vi.mocked(openAIResponse).mockResolvedValue({ content, usage: undefined, citations: ['https://example.org/beans'] });
    const result = await researchNutrition('cooked beans', 'user-one');
    expect(result?.kcal_per_100g).toBe(47);
    expect(verifiedWebNutrition(result!.nutrition_ref, 'user-one')?.fat_g_per_100g).toBe(0.2);
    expect(verifiedWebNutrition(result!.nutrition_ref, 'user-two')).toBeUndefined();
    expect(verifiedWebNutrition(result!.nutrition_ref + 'x', 'user-one')).toBeUndefined();
  });
  it('leaves nutrition unavailable without a citation or for impossible values', async () => {
    vi.stubEnv('JWT_SECRET', 'a long test signing secret');
    vi.mocked(openAIResponse).mockResolvedValueOnce({ content, usage: undefined, citations: [] });
    expect(await researchNutrition('cooked beans', 'user-one')).toBeUndefined();
    vi.mocked(openAIResponse).mockResolvedValueOnce({ content: content.replace('"fat":0.2', '"fat":500'), usage: undefined, citations: ['https://example.org/beans'] });
    expect(await researchNutrition('cooked beans', 'user-one')).toBeUndefined();
  });
});
