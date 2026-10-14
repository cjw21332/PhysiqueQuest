import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { CoachService } from '../src/coach/coach.service.js';

const user = '507f1f77bcf86cd799439011';
const otherUser = '507f1f77bcf86cd799439012';
const profile = { goal: 'Build muscle', days: ['M', 'T', 'W', 'T', 'F'], duration: '60 min', equipment: ['Dumbbells'], conditions: [] };
function setup() {
  let current = { ...profile };
  const records = new Map<string, any>();
  const key = (query: any) => `${query.userId}:${query.contextHash}`;
  const query = (read: () => any) => ({ lean: () => ({ exec: async () => read() }) });
  const programs = {
    findOne: vi.fn(filter => query(() => records.get(key(filter)) ?? null)),
    findOneAndUpdate: vi.fn((filter, update) => query(() => {
      if (!records.has(key(filter))) records.set(key(filter), { _id: `saved-${records.size}`, ...update.$setOnInsert, createdAt: new Date() });
      return records.get(key(filter));
    })),
  };
  const provider = { getForPlan: vi.fn(async () => [{ _id: 'provider-bench', name: 'Dumbbell bench press', group: 'Chest', targetMuscle: 'Chest', equipment: 'Dumbbell', pose: 'missing', instructions: ['Keep wrists straight.'], gifUrl: 'https://example.com/fresh.gif' }]) };
  const profiles = { findOne: () => query(() => current) };
  const settings = { findOne: () => query(() => null) };
  const service = () => new CoachService(profiles as any, settings as any, provider as any, programs as any);
  return { service, provider, programs, records, change: (patch: any) => { current = { ...current, ...patch }; } };
}

describe('saved per-user Coach programs', () => {
  it('persists daily prescriptions and reuses them after service restart without provider calls', async () => {
    const test = setup();
    const first = await test.service().getPlan(user);
    const second = await test.service().getPlan(user);
    expect(second.days).toEqual(first.days);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(1);
    expect(test.records.size).toBe(1);
    const saved = [...test.records.values()][0].plan;
    expect(saved.days[0].exercises[0]).toMatchObject({ exerciseId: 'provider-bench', prescription: '4 × 10' });
    expect(saved.days[0].exercises[0]).not.toHaveProperty('gifUrl');
  });

  it('deduplicates concurrent loads for the same user', async () => {
    const test = setup(), service = test.service();
    const plans = await Promise.all([service.getPlan(user), service.getPlan(user), service.getPlan(user)]);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(1);
    expect(plans[0].days).toEqual(plans[2].days);
  });

  it('isolates users and regenerates only for changed program preferences', async () => {
    const test = setup(), service = test.service();
    await service.getPlan(user);
    test.change({ name: 'Changed display name', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] });
    await service.getPlan(user);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(1);
    await service.getPlan(otherUser);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(2);
    test.change({ conditions: ['Shoulder impingement'] });
    await service.getPlan(user);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(3);
    test.change({ duration: '20 min' });
    expect((await service.getPlan(user)).duration).toBe('20 min');
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(4);
  });

  it.each([
    { goal: 'Strength' },
    { days: ['Tuesday', 'Saturday'] },
    { equipment: ['Full gym'] },
  ])('generates a replacement when program preferences change: %j', async patch => {
    const test = setup(), service = test.service();
    await service.getPlan(user);
    test.change(patch);
    await service.getPlan(user);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(2);
    expect(test.records.size).toBe(2);
    await service.getPlan(user);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(2);
  });

  it('serves a saved program during a provider outage and does not save empty generations', async () => {
    const test = setup(), service = test.service();
    await service.getPlan(user);
    test.provider.getForPlan.mockRejectedValue(new Error('Provider unavailable'));
    expect((await test.service().getPlan(user)).libraryReady).toBe(true);
    test.change({ goal: 'Strength' });
    await expect(service.getPlan(user)).rejects.toThrow('Provider unavailable');
    test.provider.getForPlan.mockResolvedValue([]);
    expect((await service.getPlan(user)).libraryReady).toBe(false);
    expect(test.records.size).toBe(1);
  });
});
