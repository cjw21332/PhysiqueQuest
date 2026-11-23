import { describe, expect, it, vi } from 'vitest';
import { mealMissionGoal, mealMissionPoints } from '../src/activity/meal-mission.js';
import { CoachController } from '../src/coach/coach.controller.js';
import { openAIResponse } from '../src/common/openai.js';
vi.mock('../src/common/openai.js', () => ({ openAIResponse: vi.fn() }));

describe('equipment photo review', () => {
  const controller = new CoachController({} as never);
  const photo = 'data:image/jpeg;base64,/9j/AAAA';
  it('requires consent and rejects an external URL before invoking the provider', async () => {
    await expect(controller.checkEquipment({ photo, consent: false })).rejects.toThrow();
    await expect(controller.checkEquipment({ photo: 'https://example.com/photo.jpg', consent: true })).rejects.toThrow();
    expect(openAIResponse).not.toHaveBeenCalled();
  });
  it('flags apparent damage and rejects provider claims of safety', async () => {
    vi.mocked(openAIResponse).mockResolvedValueOnce({ content: '{"status":"visible_damage"}', usage: undefined });
    await expect(controller.checkEquipment({ photo, consent: true })).resolves.toEqual({ status: 'visible_damage' });
    vi.mocked(openAIResponse).mockResolvedValueOnce({ content: '{"status":"safe"}', usage: undefined });
    await expect(controller.checkEquipment({ photo, consent: true })).rejects.toThrow('unavailable');
  });
});

it('uses the previous calendar day for a two-meal mission and preserves full three-meal credit', () => {
  const history = new Map([['2026-10-31', 1]]);
  expect(mealMissionGoal('2026-11-01', history)).toBe(2);
  expect(mealMissionGoal('2026-11-02', history)).toBe(3);
  expect(mealMissionPoints(2, 2)).toBe(40);
  expect(mealMissionPoints(3, 2)).toBe(60);
  expect(mealMissionPoints(2, 3)).toBe(0);
});
