import 'reflect-metadata';
import { Types, type Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateFeedbackDto } from '../src/feedback/dto/feedback.dto.js';
import { FeedbackService } from '../src/feedback/feedback.service.js';
import type { WorkoutFeedback } from '../src/feedback/schemas/workout-feedback.schema.js';
import { transformFeedbackHealth } from '../src/privacy/health-encryption.js';
import { lifecycleModel } from './lifecycle-model.fixture.js';
import { randomBytes } from 'node:crypto';

const valid = { source: 'pose', exercise: 'Squat', rpe: 7, difficulty: 'just_right' };
const errorsFor = async (over: Record<string, unknown>) => {
  const dto = plainToInstance(CreateFeedbackDto, { ...valid, ...over });
  return { dto, props: (await validate(dto)).map((e) => e.property) };
};

describe('CreateFeedbackDto', () => {
  it('accepts a valid payload', async () => {
    expect((await errorsFor({ painLocations: ['knee'], enjoyment: 4 })).props).toEqual([]);
  });
  it('rejects unknown source and difficulty', async () => {
    expect((await errorsFor({ source: 'chat' })).props).toContain('source');
    expect((await errorsFor({ difficulty: 'hard' })).props).toContain('difficulty');
  });
  it.each([0, 11, 5.5])('rejects rpe %s', async (rpe) => {
    expect((await errorsFor({ rpe })).props).toContain('rpe');
  });
  it('limits pain locations', async () => {
    expect((await errorsFor({ painLocations: Array(11).fill('knee') })).props).toContain('painLocations');
    expect((await errorsFor({ painLocations: ['x'.repeat(41)] })).props).toContain('painLocations');
  });
  it('trims exercise and rejects blank', async () => {
    const { dto, props } = await errorsFor({ exercise: '  Squat  ' });
    expect(dto.exercise).toBe('Squat');
    expect(props).toEqual([]);
    expect((await errorsFor({ exercise: '   ' })).props).toContain('exercise');
  });
});

describe('FeedbackService.list', () => {
  const setup = () => {
    const limits: number[] = [];
    const find = vi.fn(() => ({ sort: () => ({ limit: (n: number) => { limits.push(n); return { lean: () => [] }; } }) }));
    const service = new FeedbackService({ find } as unknown as Model<WorkoutFeedback>);
    return { service, find, limits };
  };
  it('scopes the query to the requesting user', () => {
    const { service, find } = setup();
    const id = new Types.ObjectId().toHexString();
    service.list(id);
    expect(find).toHaveBeenCalledWith({ userId: new Types.ObjectId(id) });
  });
  it('clamps the limit to 1..50', () => {
    const { service, limits } = setup();
    const id = new Types.ObjectId().toHexString();
    for (const n of [undefined, 0, -5, 999, 10]) service.list(id, n);
    expect(limits).toEqual([20, 20, 1, 50, 10]);
  });
});

describe('FeedbackService.create', () => {
  const owner = new Types.ObjectId().toHexString();
  const setup = () => {
    const created: any[] = [];
    const upserts: any[] = [];
    const model = lifecycleModel({
      create: vi.fn(async (rows: any[]) => rows.map(row => { created.push(row); return { toObject: () => ({ _id: new Types.ObjectId(), ...row }) }; })),
      findOneAndUpdate: vi.fn((filter: any, update: any, options: any) => { upserts.push({ filter, update, options }); const doc = { _id: new Types.ObjectId(), ...update.$set }; const chain: any = { lean: () => ({ exec: async () => doc }) }; return chain; }),
    } as any);
    return { service: new FeedbackService(model as unknown as Model<WorkoutFeedback>), created, upserts };
  };

  it('encrypts pain locations and notes at rest and never echoes them back', async () => {
    vi.stubEnv('HEALTH_DATA_ENCRYPTION_KEY', randomBytes(32).toString('base64'));
    try {
      const { service, created } = setup();
      const result = await service.create(owner, { ...valid, painLocations: [' left knee ', 'left knee', ''], notes: ' sore ' } as any);
      expect(JSON.stringify(result)).not.toMatch(/knee|sore|pqenc/);
      const [row] = created;
      expect(row.painLocations).toHaveLength(1);
      expect(row.painLocations[0]).toMatch(/^pqenc:v1:/);
      expect(row.notes).toMatch(/^pqenc:v1:/);
      const decrypted = transformFeedbackHealth({ ...row }, false);
      expect(decrypted).toMatchObject({ painLocations: ['left knee'], notes: 'sore' });
    } finally { vi.unstubAllEnvs(); }
  });

  it('replaces an earlier answer for the same session and exercise', async () => {
    const { service, created, upserts } = setup();
    await service.create(owner, { ...valid, sessionRef: 'workout-1' } as any);
    expect(created).toHaveLength(0);
    expect(upserts[0].filter).toMatchObject({ sessionRef: 'workout-1', exercise: 'Squat' });
    expect(upserts[0].options).toMatchObject({ upsert: true });
    expect(upserts[0].update.$unset).toEqual({ enjoyment: '', notes: '' });
  });
});
