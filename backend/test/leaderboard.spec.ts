import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { LeaderboardService } from '../src/leaderboard/leaderboard.service.js';
import { activityDate, earnsWorkoutCredit } from '../src/workouts/workout-contract.js';

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
    { aggregate: vi.fn(async () => {
      const rows = (overrides.workouts ?? []).map((row: any) => ({ status: 'completed', endedAt: new Date('2099-01-01T10:00:00Z'), ...row }));
      const days = new Map();
      for (const row of rows) if (earnsWorkoutCredit(row)) { const day = row.activityDate || activityDate(row.endedAt, row.timezone ?? 'UTC'); days.set(`${row.userId}:${day}`, { userId: row.userId, day }); }
      return [...days.values()];
    }) } as any,
  );

describe('leaderboard', () => {
  it('excludes points belonging to users absent from the active-user lookup', async () => {
    const service = build({ workouts: [{ userId: A }, { userId: B }], users: [{ _id: A, name: 'Ana' }] });
    const result = await service.get(A, 'all');
    expect(result.entries.map(entry => entry.userId)).toEqual([A]);
    expect((service as any).users.find).toHaveBeenCalledWith(expect.objectContaining({ isActive: { $ne: false }, deletedAt: null }));
  });
  it('credits a training day once and excludes standalone recordings and skipped sessions', async () => {
    const service = build({ workouts: [{ userId: A }, { userId: A }, { userId: A, origin: 'recorded-set' }, { userId: A, sets: [{ status: 'skipped' }] }], users: [{ _id: A, name: 'Ana' }] });
    expect((await service.get(A, 'all')).self.points).toBe(100);
  });
  it('ranks by points, hides opted-out users, and always returns the caller', async () => {
    const service = build({
      workouts: [{ userId: A }, { userId: A, endedAt: new Date('2099-01-02T10:00:00Z') }, { userId: B }],
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


describe('leaderboard read efficiency', () => {
  it('keeps points, privacy and rank while loading only scoring fields', async () => {
    const selections: string[] = [];
    const nutrition = { find: vi.fn(() => ({ select: (fields: string) => {
      selections.push(fields);
      return { lean: () => ({ exec: async () => [{ userId: A, meals: [1, 2, 3].map(() => ({ date: '2099-01-01' })), water: [{ date: '2099-01-01', glasses: 8 }] }] }) };
    } })) };
    const settings = { find: vi.fn(() => ({ select: (fields: string) => {
      selections.push(fields);
      return { lean: () => ({ exec: async () => [{ userId: B, values: { showLeaderboard: false } }] }) };
    } })) };
    const users = findModel([{ _id: A, name: 'Ana' }, { _id: B, name: 'Ben' }]);
    const service = new LeaderboardService(snapshots(), users, settings as any, nutrition as any, { aggregate: vi.fn(async () => [{ userId: A, day: '2099-01-01' }, { userId: B, day: '2099-01-01' }]) } as any);
    const result = await service.get(A, 'all');
    expect(result.self).toMatchObject({ userId: A, rank: 1, points: 200 });
    expect(result.entries.map(entry => entry.userId)).toEqual([A]);
    expect(selections).toContain('userId meals.date water.date water.glasses');
    expect(selections).toContain('userId values.showLeaderboard');
    expect(settings.find).toHaveBeenCalledWith({ 'values.showLeaderboard': false });
    const requestedIds = users.find.mock.calls[0][0]._id.$in.map(String);
    expect(requestedIds.sort()).toEqual([A, B]); // Caller already in points: no duplicate identifier.
  });

  it('starts privacy and history reads while the scoring read is pending', async () => {
    const service = build();
    let finish!: (value: Map<string, number>) => void;
    vi.spyOn(service as any, 'computePoints').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const hidden = vi.spyOn(service as any, 'hiddenUsers').mockResolvedValue(new Set());
    const previous = vi.spyOn(service as any, 'previousRanks').mockResolvedValue(new Map());
    const request = service.get(A, 'all');
    expect(hidden).toHaveBeenCalledOnce();
    expect(previous).toHaveBeenCalledOnce();
    finish(new Map());
    expect((await request).self).toMatchObject({ userId: A, points: 0, rank: 1 });
  });
});
