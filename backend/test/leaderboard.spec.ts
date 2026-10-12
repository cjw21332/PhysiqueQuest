import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { LeaderboardService } from '../src/leaderboard/leaderboard.service.js';

const A = '507f1f77bcf86cd799439011';
const B = '507f1f77bcf86cd799439012';
const C = '507f1f77bcf86cd799439013';

const chain = (rows: unknown[]) =>
  ({ select: () => ({ lean: () => ({ exec: async () => rows }) }) });

const findModel = (rows: unknown[] | (() => unknown[])) =>
  ({ find: vi.fn(() => chain(typeof rows === 'function' ? rows() : rows)) }) as any;

const snapshots = (previous: unknown[] = []) =>
  ({
    find: vi.fn(() => ({ sort: () => ({ limit: () => ({ lean: () => ({ exec: async () => previous }) }) }) })),
    bulkWrite: vi.fn(async () => ({})),
  }) as any;

const build = (overrides: {
  workouts?: unknown[];
  nutrition?: unknown[];
  users?: unknown[];
  settings?: unknown[];
  previous?: unknown[];
} = {}) =>
  new LeaderboardService(
    snapshots(overrides.previous ?? []),
    findModel(overrides.users ?? []),
    findModel(overrides.settings ?? []),
    findModel(overrides.nutrition ?? []),
    findModel(overrides.workouts ?? []),
  );

describe('leaderboard', () => {
  it('ranks by points, hides opted-out users, and always returns the caller', async () => {
    const service = build({
      workouts: [{ userId: A }, { userId: A }, { userId: B }],
      users: [{ _id: A, name: 'Ana' }, { _id: B, name: 'Ben' }, { _id: C, name: 'Cara' }],
      settings: [{ userId: B, values: { showLeaderboard: false } }],
    });

    const result = await service.get(C, 'week');

    expect(result.self.points).toBe(0);
    expect(result.self.rank).toBe(3);
    expect(result.entries.map(entry => entry.userId)).toEqual([A, C]);
    expect(result.entries[0]).toMatchObject({ name: 'Ana', points: 200, rank: 1 });
    expect(result.context).toEqual({ previousName: 'Ana', pointsBehind: 200 });
  });

  it('derives upward movement from the previous boundary snapshot', async () => {
    const service = build({
      workouts: [{ userId: A }],
      users: [{ _id: A, name: 'Ana' }],
      previous: [{ boundaryKey: '0000-00-00', subjectId: A, rank: 3 }],
    });

    const result = await service.get(A, 'week');

    expect(result.self.movement).toBe(2);
  });

  it('awards meal and water day bonuses', async () => {
    const service = build({
      nutrition: [{
        userId: A,
        meals: [{ date: '2099-01-01' }, { date: '2099-01-01' }, { date: '2099-01-01' }, { date: '2099-01-02' }],
        water: [{ date: '2099-01-01', glasses: 8 }],
      }],
      users: [{ _id: A, name: 'Ana' }],
    });

    const result = await service.get(A, 'all');

    // 3 meals on one day (60) + 8 glasses that day (40); the second meal day is short.
    expect(result.self.points).toBe(100);
  });
});
