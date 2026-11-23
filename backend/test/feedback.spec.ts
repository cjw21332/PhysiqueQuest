import 'reflect-metadata';
import { Types, type Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateFeedbackDto } from '../src/feedback/dto/feedback.dto.js';
import { FeedbackService } from '../src/feedback/feedback.service.js';
import type { WorkoutFeedback } from '../src/feedback/schemas/workout-feedback.schema.js';

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
