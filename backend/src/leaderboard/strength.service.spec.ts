import { describe, expect, it } from 'vitest';
import { StrengthService, estimatedMax } from './strength.service.js';

describe('strength rankings', () => {
  it('uses the actual single and Epley estimates for repeated sets', () => {
    expect(estimatedMax(100, 1)).toBe(100);
    expect(estimatedMax(90, 10)).toBe(120);
  });
  it('ranks completed sets, converts bodyweight, and excludes hidden users', async () => {
    const a = 'aaaaaaaaaaaaaaaaaaaaaaaa', b = 'bbbbbbbbbbbbbbbbbbbbbbbb', c = 'cccccccccccccccccccccccc';
    const query = (items: unknown[]) => ({ select: () => ({ lean: () => ({ exec: async () => items, cursor: () => ({ async *[Symbol.asyncIterator]() { yield* items; } }) }) }) });
    const workout = (id: string, load: number, reps: number) => ({ userId: id, exercises: [{ exerciseId: 'squat', name: 'Squat' }], sets: [{ exerciseId: 'squat', status: 'completed', loadKg: load, reps }] });
    const service = new StrengthService(
      { find: () => query([workout(a, 90, 10), workout(a, 100, 1), workout(b, 110, 1), workout(c, 200, 1)]) } as never,
      { collection: { find: () => ({ toArray: async () => [{ userId: a, weight: '200', weightUnit: 'lbs' }, { userId: b, weight: '80', weightUnit: 'kg' }] }) } } as never,
      { find: () => query([{ _id: a, name: 'A' }, { _id: b, name: 'B' }, { _id: c, name: 'C' }]) } as never,
      { find: () => query([{ userId: c }]) } as never,
    );
    const absolute = await service.get(a, 'squat', 'heaviest');
    expect(absolute.entries.map(row => row.userId)).toEqual([a, b]);
    expect(absolute.entries[0].maxKg).toBe(120);
    const relative = await service.get(a, 'squat', 'relative');
    expect(relative.entries.map(row => row.userId)).toEqual([b, a]);
    expect(relative.entries[1].score).toBeCloseTo(120 / (200 / 2.2046226218));
  });
});
