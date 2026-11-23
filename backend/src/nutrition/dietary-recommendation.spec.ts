import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DietaryRecommendationService } from './dietary-recommendation.service.js';

const generateContent = vi.hoisted(() => vi.fn());
vi.mock('../common/openai.js', () => ({ OPENAI_MODEL: 'default-model', openAIResponse: generateContent }));

describe('dietary recommendations', () => {
  const profile = { age: '30', height: '170', heightUnit: 'cm', weight: '70', weightUnit: 'kg', activity: 'Moderate', goal: 'Maintain', gender: 'Male' };
  const profiles = { findOne: () => ({ select: () => ({ lean: () => ({ exec: async () => profile }) }) }) };
  const service = new DietaryRecommendationService(profiles as never, { get: () => 'configured' } as never, { read: async () => ({ meals: [{ scanSavedAt: new Date(), protein: 12, carbs: 15, fat: 3, name: 'Private meal' }] }) } as never);
  beforeEach(() => generateContent.mockReset());
  it('returns a valid proposal and rejects malformed model output', async () => {
    const proposal = { goal: 'Maintenance', calories: 2300, protein: 30, carbs: 45, fat: 25 };
    generateContent.mockResolvedValueOnce({ content: JSON.stringify(proposal) }).mockResolvedValueOnce({ content: JSON.stringify({ ...proposal, fat: 10 }) });
    await expect(service.recommend('507f1f77bcf86cd799439011')).resolves.toEqual(proposal);
    const prompt = generateContent.mock.calls[0][0][0].content;
    expect(prompt).toContain('"proteinGrams":12');
    expect(prompt).not.toContain('Private meal');
    await expect(service.recommend('507f1f77bcf86cd799439011')).rejects.toThrow('AI recommendations are unavailable');
  });
});
