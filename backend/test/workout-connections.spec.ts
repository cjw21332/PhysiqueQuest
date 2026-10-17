import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { WorkoutsService } from '../src/workouts/workouts.service.js';
import { WorkoutSessionSchema } from '../src/workouts/schemas/workout-session.schema.js';
import {
  earnsWorkoutCredit,
  activityDate,
} from '../src/workouts/workout-contract.js';
import { ActivityService } from '../src/activity/activity.service.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { NutritionService } from '../src/nutrition/nutrition.service.js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  SaveSetDto,
  RecordedWorkoutDto,
} from '../src/workouts/dto/workout.dto.js';
const owner = '507f1f77bcf86cd799439011',
  id = '507f1f77bcf86cd799439012';
const exercise = {
  exerciseId: 'camera-pushup',
  name: 'Push-up',
  equipment: 'Bodyweight',
  sets: 1,
};
const set = {
  setId: 'camera-pushup:0',
  exerciseId: 'camera-pushup',
  setIndex: 0,
  reps: 8,
  status: 'completed' as const,
  source: 'manual' as const,
};
function fixture() {
  let doc: any = null;
  const findOneAndUpdate = vi.fn(async (filter: any, update: any) => {
    if (update.$setOnInsert) {
      if (!doc) doc = { _id: new Types.ObjectId(id), ...update.$setOnInsert };
      return structuredClone(doc);
    }
    if (
      !doc ||
      filter.status !== doc.status ||
      (filter.revision !== undefined && filter.revision !== doc.revision) ||
      (filter.$or && (doc.revision ?? 0) !== 0)
    )
      return null;
    doc = { ...doc, ...update.$set, revision: doc.revision + 1 };
    return structuredClone(doc);
  });
  const model: any = {
    findOneAndUpdate,
    findOne: vi.fn((filter: any) => ({
      exec: async () =>
        doc && String(filter.userId) === owner ? structuredClone(doc) : null,
    })),
  };
  return { service: new WorkoutsService(model), model, read: () => doc };
}
const start = {
  requestKey: 'stable-start-0001',
  exerciseIds: [exercise.exerciseId],
  exercises: [exercise],
  startedAt: '2026-10-01T10:00:00Z',
  origin: 'planned' as const,
  timezone: 'Asia/Taipei',
};
describe('connected workout persistence', () => {
  it('rejects missing nested results and invalid timed set values before service execution', async () => {
    expect(
      await validate(plainToInstance(SaveSetDto, { expectedRevision: 0 })),
    ).not.toEqual([]);
    expect(
      await validate(
        plainToInstance(RecordedWorkoutDto, { requestKey: 'valid-key-01' }),
      ),
    ).not.toEqual([]);
    expect(
      await validate(
        plainToInstance(SaveSetDto, {
          expectedRevision: 0,
          result: { ...set, durationSeconds: -1 },
        }),
      ),
    ).not.toEqual([]);
  });
  it('paginates equal timestamps using the record ID so tied recordings are not skipped', async () => {
    const find = vi.fn((_filter: unknown) => ({
      sort: () => ({ limit: async () => [] }),
    }));
    await new WorkoutsService({ find } as any).list(
      owner,
      20,
      `2026-10-01T10:00:00Z|${id}`,
    );
    expect(find.mock.calls[0][0]).toMatchObject({
      userId: new Types.ObjectId(owner),
      $or: [
        { startedAt: { $lt: new Date('2026-10-01T10:00:00Z') } },
        {
          startedAt: new Date('2026-10-01T10:00:00Z'),
          _id: { $lt: new Types.ObjectId(id) },
        },
      ],
    });
  });
  it('declares the unique owner/save-key index needed for concurrent upserts', () => {
    expect(WorkoutSessionSchema.indexes()).toContainEqual([
      { userId: 1, requestKey: 1 },
      {
        unique: true,
        partialFilterExpression: { requestKey: { $type: 'string' } },
      },
    ]);
  });
  it('replays a lost creation response and rejects a changed payload using the same key', async () => {
    const { service } = fixture();
    const first = await service.create(owner, start);
    const replay = await service.create(owner, start);
    expect(first._id).toEqual(replay._id);
    await expect(
      service.create(owner, { ...start, startedAt: '2026-10-01T10:01:00Z' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('saves reviewed sets with an atomic revision check and replays acknowledgements', async () => {
    const { service, model, read } = fixture();
    await service.create(owner, start);
    await service.saveSet(owner, id, { expectedRevision: 0, result: set });
    const calls = model.findOneAndUpdate.mock.calls.length;
    await service.saveSet(owner, id, {
      expectedRevision: 0,
      result: { ...set },
    });
    expect(model.findOneAndUpdate).toHaveBeenCalledTimes(calls);
    await expect(
      service.saveSet(owner, id, {
        expectedRevision: 0,
        result: { ...set, reps: 9 },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(read().sets).toEqual([set]);
    expect(model.findOneAndUpdate.mock.calls[1][0]).toMatchObject({
      status: 'active',
      userId: new Types.ObjectId(owner),
    });
  });
  it('rejects cross-account access and unplanned sets', async () => {
    const { service } = fixture();
    await service.create(owner, start);
    await expect(service.detail(id, id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.saveSet(owner, id, {
        expectedRevision: 0,
        result: { ...set, exerciseId: 'unrelated' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('requires explicit set review and only one of two simultaneous revisions can win', async () => {
    const { service } = fixture();
    await service.create(owner, start);
    const finish = {
      endedAt: '2026-10-01T10:05:00Z',
      durationSeconds: 0,
      exerciseResults: [],
      expectedRevision: 0,
    };
    await expect(service.complete(owner, id, finish)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const results = await Promise.allSettled([
      service.saveSet(owner, id, { expectedRevision: 0, result: set }),
      service.saveSet(owner, id, {
        expectedRevision: 0,
        result: { ...set, reps: 12 },
      }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const completed = await service.complete(owner, id, {
      ...finish,
      expectedRevision: 1,
    });
    const replay = await service.complete(owner, id, {
      ...finish,
      expectedRevision: 1,
    });
    expect(completed.revision).toBe(replay.revision);
    await expect(
      service.complete(owner, id, {
        ...finish,
        expectedRevision: 1,
        endedAt: '2026-10-01T10:06:00Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('records a standalone clip in one idempotent mutation, with separate clip duration and activity time', async () => {
    const { service, model } = fixture();
    const payload = {
      requestKey: 'recording-once-001',
      exercise,
      result: { ...set, clipDurationSeconds: 12 },
      performedAt: '2026-10-01T16:30:00Z',
      timezone: 'Asia/Taipei',
    };
    const first = await service.record(owner, payload);
    const replay = await service.record(owner, payload);
    expect(first.activityDate).toBe('2026-10-02');
    expect(first.durationSeconds).toBe(12);
    expect(first.startedAt).toEqual(first.endedAt);
    expect(String(first._id)).toBe(String(replay._id));
    expect(earnsWorkoutCredit(first)).toBe(false);
    expect(model.findOneAndUpdate.mock.calls[0][1]).toHaveProperty(
      '$setOnInsert',
    );
  });
  it('summary aggregation is not capped at the recent history limit', async () => {
    const dates = Array.from({ length: 150 }, (_, index) => ({
      _id: String(index),
    }));
    const aggregate = vi.fn(async () => [{ dates, personalRecords: [] }]);
    const result = await new WorkoutsService({ aggregate } as any).summary(
      owner,
      'Asia/Taipei',
    );
    expect(result.trainingDates).toHaveLength(150);
    expect(JSON.stringify(aggregate.mock.calls)).not.toContain('$limit');
  });
});
describe('read costs and shared credit rules', () => {
  it('activity refresh performs zero preference writes and uses unrestricted credit history', async () => {
    const write = vi.fn();
    const findOne = vi.fn(() => ({ exec: async () => null }));
    const creditHistory = vi.fn(async () => [
      {
        status: 'completed',
        endedAt: new Date(),
        activityDate: activityDate(new Date(), 'Asia/Taipei'),
      },
    ]);
    const activity = new ActivityService(
      { findOne, findOneAndUpdate: write } as any,
      { read: async () => ({ meals: [], water: [] }) } as any,
      { creditHistory } as any,
    );
    const result = await activity.get(owner, 'Asia/Taipei');
    expect(write).not.toHaveBeenCalled();
    expect(result.state.questProgress.workout).toBe(1);
    expect(creditHistory).toHaveBeenCalledWith(owner, 'Asia/Taipei');
  });
  it('settings and nutrition reads do not initialize database records', async () => {
    const write = vi.fn();
    const model: any = {
      findOne: () => ({
        exec: async () => null,
        lean: () => ({ exec: async () => null }),
      }),
      findOneAndUpdate: write,
    };
    expect(await new SettingsService(model).get(owner)).toEqual({ values: {} });
    expect(await new NutritionService(model).read(owner)).toEqual({
      meals: [],
      water: [],
    });
    expect(write).not.toHaveBeenCalled();
  });
  it('uses frozen local dates and excludes individual recordings and all-skipped sessions', () => {
    expect(activityDate('2026-10-01T16:30:00Z', 'Asia/Taipei')).toBe(
      '2026-10-02',
    );
    expect(
      earnsWorkoutCredit({
        status: 'completed',
        origin: 'planned',
        sets: [{ status: 'completed' }],
      }),
    ).toBe(true);
    expect(
      earnsWorkoutCredit({
        status: 'completed',
        origin: 'recorded-set',
        sets: [{ status: 'completed' }],
      }),
    ).toBe(false);
    expect(
      earnsWorkoutCredit({
        status: 'completed',
        sets: [{ status: 'skipped' }],
      }),
    ).toBe(false);
  });
});
