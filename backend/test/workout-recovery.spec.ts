import { describe, expect, it, vi } from 'vitest';
import { Types, type Model } from 'mongoose';
import { WorkoutsService } from '../src/workouts/workouts.service.js';
import type { WorkoutSession } from '../src/workouts/schemas/workout-session.schema.js';

const owner = '507f1f77bcf86cd799439011';
function fixture(latest: Record<string, unknown> | null) {
  const sort = vi.fn().mockReturnValue({ exec: async () => latest });
  const findOne = vi.fn().mockReturnValue({ sort });
  return { service: new WorkoutsService({ findOne } as unknown as Model<WorkoutSession>), findOne, sort };
}
describe('current workout recovery', () => {
  it('does not resurrect older abandoned workouts after the latest session ends', async () => {
    const { service, findOne, sort } = fixture({ status: 'completed' });
    expect(await service.active(owner)).toBeNull();
    expect(findOne).toHaveBeenCalledWith({ userId: new Types.ObjectId(owner), origin: { $ne: 'recorded-set' } });
    expect(findOne.mock.calls[0][0]).not.toHaveProperty('status');
    expect(sort).toHaveBeenCalledWith({ startedAt: -1, _id: -1 });
  });
  it('still recovers the latest unfinished full session', async () => {
    const latest = { status: 'active', _id: 'current' };
    expect(await fixture(latest).service.active(owner)).toBe(latest);
  });
  it('returns null when no full session exists', async () => {
    expect(await fixture(null).service.active(owner)).toBeNull();
  });
});
