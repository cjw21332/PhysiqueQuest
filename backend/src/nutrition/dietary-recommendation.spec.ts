import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DietaryRecommendationService } from './dietary-recommendation.service.js';

const generateContent = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent }; } }));

describe('dietary recommendations', () => {
  const profile = { age: '30', height: '170', heightUnit: 'cm', weight: '70', weightUnit: 'kg', activity: 'Moderate', goal: 'Maintain', gender: 'Male' };
  const profiles = { findOne: () => ({ select: () => ({ lean: () => ({ exec: async () => profile }) }) }) };
  const service = new DietaryRecommendationService(profiles as never, { get: () => 'configured' } as never);
  beforeEach(() => generateContent.mockReset());
  it('returns a valid proposal and rejects malformed model output', async () => {
    const proposal = { goal: 'Maintenance', calories: 2300, protein: 30, carbs: 45, fat: 25 };
    generateContent.mockResolvedValueOnce({ text: JSON.stringify(proposal) }).mockResolvedValueOnce({ text: JSON.stringify({ ...proposal, fat: 10 }) });
    await expect(service.recommend('507f1f77bcf86cd799439011')).resolves.toEqual(proposal);
    await expect(service.recommend('507f1f77bcf86cd799439011')).rejects.toThrow('AI recommendations are unavailable');
  });
});
