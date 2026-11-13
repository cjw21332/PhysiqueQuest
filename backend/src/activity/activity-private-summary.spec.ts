import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityService } from './activity.service.js';

const OWNER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
afterEach(() => { vi.useRealTimers(); });

function fixture() {
  const findOne = vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue({ state: { timezone: 'Asia/Singapore', level: 999999, dayStreak: 999999 } }) });
  const findOneAndUpdate = vi.fn();
  const nutrition = { read: vi.fn().mockResolvedValue({ meals: [
    ...Array.from({ length: 3 }, () => ({ date: '2026-10-29', protein: 50, carbs: 80, fat: 25 })),
    { date: '2026-10-28', protein: 0, carbs: 0, fat: 0 },
  ], water: [{ date: '2026-10-29', glasses: 8 }] }) };
  const workouts = {
    creditHistory: vi.fn().mockResolvedValue([{ status: 'completed', endedAt: new Date('2026-10-29T01:00:00Z'), activityDate: '2026-10-29', earlyBird: true }]),
    personalRecordDays: vi.fn().mockResolvedValue(['2026-10-29']),
  };
  const leaderboard = { get: vi.fn().mockResolvedValue({ self: { rank: 1, points: 500 } }) };
  const users = { findById: vi.fn().mockReturnValue({ select: () => ({ lean: () => ({ exec: async () => ({ createdAt: new Date('2026-10-01T00:00:00Z') }) }) }) }) };
  const service = new ActivityService({ findOne, findOneAndUpdate } as never, nutrition as never, workouts as never, leaderboard as never, users as never);
  return { service, findOne, findOneAndUpdate, nutrition, workouts, leaderboard };
}

describe('private assistant quest computation', () => {
  it('uses exact existing quest rules with the supplied owner and never calls leaderboard or writes', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T06:00:00Z'));
    const { service, findOne, findOneAndUpdate, nutrition, workouts, leaderboard } = fixture();
    const summary = await service.getForAssistant(OWNER);
    expect(String(findOne.mock.calls[0][0].userId)).toBe(OWNER);
    expect(nutrition.read).toHaveBeenCalledExactlyOnceWith(OWNER, 'userId meals.date meals.protein meals.carbs meals.fat water.date water.glasses');
    expect(workouts.creditHistory).toHaveBeenCalledExactlyOnceWith(OWNER, 'Asia/Singapore');
    expect(workouts.personalRecordDays).toHaveBeenCalledExactlyOnceWith(OWNER, 'Asia/Singapore');
    expect(leaderboard.get).not.toHaveBeenCalled();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
    expect(summary.state).toMatchObject({ level: 4, currentExp: 50, nextLevelExp: 100, dayStreak: 2, earnedPoints: 350, questProgress: { workout: 1, meals: 3, water: 8 } });
    expect(summary.dailyMissions).toHaveLength(4);
    expect(summary.dailyMissions.every(mission => mission.complete)).toBe(true);
    expect(summary.badges.find(badge => badge.id === 'first-pr')).toMatchObject({ earned: true });
    expect(summary.badges.find(badge => badge.id === 'macro-master')).toMatchObject({ earned: true });
    expect(summary.badges.find(badge => badge.id === 'top-10')).toMatchObject({ available: false });
  });

  it('preserves leaderboard-backed behavior for the regular application endpoint', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T06:00:00Z'));
    const { service, leaderboard } = fixture();
    const summary = await service.get(OWNER);
    expect(summary.state.activityDates).toEqual(['2026-10-28', '2026-10-29']);
    expect(summary.state.accountCreatedAt).toEqual(new Date('2026-10-01T00:00:00Z'));
    expect(leaderboard.get).toHaveBeenCalledExactlyOnceWith(OWNER, 'all');
    expect(summary.badges.find(badge => badge.id === 'top-10')).toMatchObject({ available: true, earned: true });
  });

  it('does not treat missing nutrients as complete for the macro badge', async () => {
    const { service, nutrition } = fixture();
    nutrition.read.mockResolvedValue({ meals: [
      { date: '2026-10-29', protein: 150, carbs: 250, fat: 75 },
      { date: '2026-10-29', protein: 0, carbs: undefined, fat: 0 },
    ], water: [] });
    const summary = await service.getForAssistant(OWNER);
    expect(summary.badges.find(badge => badge.id === 'macro-master')).toMatchObject({ earned: false });
  });

  it('preserves the app streak cap and propagates own-data failures', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T06:00:00Z'));
    const { service, nutrition, leaderboard } = fixture();
    const dates = Array.from({ length: 400 }, (_, index) => ({ date: new Date(Date.UTC(2026, 9, 29 - index)).toISOString().slice(0, 10), protein: 0, carbs: 0, fat: 0 }));
    nutrition.read.mockResolvedValue({ meals: dates, water: [] });
    expect((await service.getForAssistant(OWNER)).state.dayStreak).toBe(365);
    nutrition.read.mockRejectedValue(new Error('Unavailable'));
    await expect(service.getForAssistant(OWNER)).rejects.toThrow('Unavailable');
    expect(leaderboard.get).not.toHaveBeenCalled();
  });
});
