import { lifecycleModel } from '../../test/lifecycle-model.fixture.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityService } from './activity.service.js';

const OWNER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
afterEach(() => { vi.useRealTimers(); });

function fixture() {
  const findOne = vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue({ state: { timezone: 'Asia/Singapore', level: 999999, dayStreak: 999999 } }) });
  const findOneAndUpdate = vi.fn();
  const nutrition = { read: vi.fn().mockResolvedValue({ meals: [
    ...Array.from({ length: 3 }, (_, index) => ({ date: '2026-10-29', scanGroupId: String(index), scanSavedAt: new Date('2026-10-29T01:00:00Z'), protein: 50, carbs: 80, fat: 25 })),
    { date: '2026-10-28', protein: 0, carbs: 0, fat: 0 },
  ], water: [{ date: '2026-10-29', glasses: 8 }] }) };
  const workouts = {
    creditHistory: vi.fn().mockResolvedValue([{ status: 'completed', endedAt: new Date('2026-10-29T01:00:00Z'), activityDate: '2026-10-29', earlyBird: true }]),
    personalRecordDays: vi.fn().mockResolvedValue(['2026-10-29']),
  };
  const leaderboard = { get: vi.fn().mockResolvedValue({ self: { rank: 1, points: 500 } }) };
  const users = { findById: vi.fn().mockReturnValue({ select: () => ({ lean: () => ({ exec: async () => ({ createdAt: new Date('2026-10-01T00:00:00Z') }) }) }) }) };
  const service = new ActivityService(lifecycleModel({ findOne, findOneAndUpdate } as never), nutrition as never, workouts as never, leaderboard as never, users as never);
  return { service, findOne, findOneAndUpdate, nutrition, workouts, leaderboard };
}

describe('private assistant quest computation', () => {
  it('uses exact existing quest rules with the supplied owner and never calls leaderboard or writes', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T06:00:00Z'));
    const { service, findOne, findOneAndUpdate, nutrition, workouts, leaderboard } = fixture();
    const summary = await service.getForAssistant(OWNER);
    expect(String(findOne.mock.calls[0][0].userId)).toBe(OWNER);
    expect(nutrition.read).toHaveBeenCalledExactlyOnceWith(OWNER, 'userId meals.id meals.date meals.scanSavedAt meals.scanGroupId meals.protein meals.carbs meals.fat meals.calories dietaryPlan.calories scanSaveReceipts.key scanSaveReceipts.mealIds water.date water.glasses');
    expect(workouts.creditHistory).toHaveBeenCalledExactlyOnceWith(OWNER, 'Asia/Singapore');
    expect(workouts.personalRecordDays).toHaveBeenCalledExactlyOnceWith(OWNER, 'Asia/Singapore');
    expect(leaderboard.get).not.toHaveBeenCalled();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
    expect(summary.state).toMatchObject({ level: 4, currentExp: 50, nextLevelExp: 100, dayStreak: 2, earnedPoints: 350, questProgress: { workout: 1, meals: 3, water: 8 } });
    expect(summary.dailyMissions).toHaveLength(4);
    expect(summary.dailyMissions.every(mission => mission.complete)).toBe(true);
    expect(summary.badges.find(badge => badge.id === 'first-pr')).toMatchObject({ earned: true });
    expect(summary.badges.find(badge => badge.id === 'macro-master')).toMatchObject({ earned: true });
    expect(summary.badges.find(badge => badge.id === 'streak-30')).toMatchObject({ earned: false, progress: { current: 2, target: 30, unit: 'days' } });
    expect(summary.badges.find(badge => badge.id === 'hydrated')).toMatchObject({ earned: true, progress: { current: 8, target: 8 } });
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

  it('derives the new badge milestones from real activity, loads, and unavailable data', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T06:00:00Z'));
    const { service, nutrition, workouts, leaderboard } = fixture();
    const dates = Array.from({ length: 20 }, (_, index) => new Date(Date.UTC(2026, 9, 29 - index)).toISOString().slice(0, 10));
    nutrition.read.mockResolvedValue({ meals: dates.slice(0, 7).flatMap(date => [0, 1, 2].map(n => ({ date, scanGroupId: `${date}-${n}`, scanSavedAt: new Date(), protein: 50, carbs: 80, fat: 25 }))), water: dates.map(date => ({ date, glasses: 8 })) });
    workouts.creditHistory.mockResolvedValue(dates.slice(0, 7).map(date => ({ status: 'completed', endedAt: new Date(`${date}T01:00:00Z`), activityDate: date, earlyBird: true })));
    workouts.personalRecordDays.mockResolvedValue(dates.slice(0, 7));
    (workouts as any).summary = vi.fn().mockResolvedValue({ personalRecords: [{ loadKg: 50 }, { loadKg: 110 }] });
    leaderboard.get.mockResolvedValue({ self: { rank: 42, points: 500 } });
    const result = await service.get(OWNER);
    for (const id of ['first-workout', 'personal-record', 'goal-7', 'hydration-20', 'top-100', 'top-50', 'lift-50', 'level-beginner']) expect(result.badges.find(badge => badge.id === id)?.earned, id).toBe(true);
    expect(result.badges.find(badge => badge.id === 'lift-150')).toMatchObject({ earned: false, progress: { current: 110, target: 150 } });
    expect(result.badges.find(badge => badge.id === 'top-10')?.earned).toBe(false);
    expect(result.badges.find(badge => badge.id === 'calories-100')).toMatchObject({ earned: false, available: false });
    expect(result.badges.find(badge => badge.id === 'best-form')).toMatchObject({ earned: false, available: false });
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
