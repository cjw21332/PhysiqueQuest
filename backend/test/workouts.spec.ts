import { NotFoundException } from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { WorkoutsService } from '../src/workouts/workouts.service.js';
import type { WorkoutSession } from '../src/workouts/schemas/workout-session.schema.js';

describe('workout persistence', () => {
  it('creates an authenticated owner session and reloads it', async () => {
    const saved = { _id: new Types.ObjectId(), userId: new Types.ObjectId('507f1f77bcf86cd799439011'), exerciseIds: ['press'], status: 'active', startedAt: new Date('2026-10-04T10:00:00Z') };
    const create = vi.fn().mockResolvedValue(saved);
    const find = vi.fn().mockReturnValue({ sort: () => ({ limit: async () => [saved] }) });
    const service = new WorkoutsService({ create, find } as unknown as Model<WorkoutSession>);
    await service.create('507f1f77bcf86cd799439011', { exerciseIds: ['press'], startedAt: '2026-10-04T10:00:00.000Z' });
    expect(create.mock.calls[0]?.[0].userId).toEqual(saved.userId);
    expect((await service.list('507f1f77bcf86cd799439011')).map(item => item._id)).toEqual([saved._id]);
  });

  it('scopes pause/resume to the owner and persists elapsed pause time', async () => {
    const doc: any = { _id: new Types.ObjectId(), userId: new Types.ObjectId('507f1f77bcf86cd799439011'), status: 'active', pausedAt: null, pausedSeconds: 0, save: vi.fn(async function (this: any) { return this; }) };
    const findOne = vi.fn().mockReturnValue({ exec: async () => doc });
    const service = new WorkoutsService({ findOne } as unknown as Model<WorkoutSession>);
    const id = String(doc._id);
    await service.setPaused('507f1f77bcf86cd799439011', id, { paused: true, occurredAt: '2026-10-04T10:01:00Z' });
    await service.setPaused('507f1f77bcf86cd799439011', id, { paused: false, occurredAt: '2026-10-04T10:02:30Z' });
    expect(doc.pausedSeconds).toBe(90);
    expect(findOne.mock.calls[0]?.[0].userId).toEqual(doc.userId);
  });

  it('stores completed report data and derives duration from server timestamps', async () => {
    const doc: any = { _id: new Types.ObjectId(), userId: new Types.ObjectId('507f1f77bcf86cd799439011'), startedAt: new Date('2026-10-04T10:00:00Z'), status: 'active', pausedSeconds: 120, save: vi.fn(async function (this: any) { return this; }) };
    const service = new WorkoutsService({ findOne: vi.fn().mockReturnValue({ exec: async () => doc }) } as unknown as Model<WorkoutSession>);
    const result = await service.complete('507f1f77bcf86cd799439011', String(doc._id), { endedAt: '2026-10-04T10:10:00Z', durationSeconds: 1, exerciseResults: [{ exerciseId: 'press', reps: 8, loadKg: 20 }] });
    expect(result.durationSeconds).toBe(480);
    expect(result.status).toBe('completed');
    expect(result.exerciseResults).toEqual([{ exerciseId: 'press', reps: 8, loadKg: 20 }]);
    expect(doc.save).toHaveBeenCalledOnce();
  });

  it('returns not found across users and makes completion replay safe', async () => {
    const findOne = vi.fn().mockReturnValue({ exec: async () => null });
    const service = new WorkoutsService({ findOne } as unknown as Model<WorkoutSession>);
    await expect(service.setPaused('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', { paused: true, occurredAt: '2026-10-04T10:01:00Z' })).rejects.toBeInstanceOf(NotFoundException);
    const completed: any = { userId: new Types.ObjectId('507f1f77bcf86cd799439011'), status: 'completed', durationSeconds: 600 };
    const completedService = new WorkoutsService({ findOne: vi.fn().mockReturnValue({ exec: async () => completed }) } as unknown as Model<WorkoutSession>);
    await expect(completedService.complete('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', { endedAt: '2026-10-04T10:10:00Z', durationSeconds: 600, exerciseResults: [] })).resolves.toBe(completed);
  });
});
