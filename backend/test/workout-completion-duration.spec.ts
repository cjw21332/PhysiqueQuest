import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CompleteWorkoutDto, SetResultDto } from '../src/workouts/dto/workout.dto.js';

describe('server-owned completion duration', () => {
  it.each([undefined, 678091])('can close an abandoned session with legacy duration %s', async durationSeconds => {
    const dto = plainToInstance(CompleteWorkoutDto, { endedAt: '2026-10-20T10:00:00Z', exerciseResults: [], ...(durationSeconds === undefined ? {} : { durationSeconds }) });
    expect(await validate(dto)).toEqual([]);
  });
  it.each([-1, 1.5, '678091'])('still rejects invalid legacy duration %s', async durationSeconds => {
    expect((await validate(plainToInstance(CompleteWorkoutDto, { endedAt: '2026-10-20T10:00:00Z', exerciseResults: [], durationSeconds }))).some(error => error.property === 'durationSeconds')).toBe(true);
  });
  it('retains the limit for an individual timed set', async () => {
    expect((await validate(plainToInstance(SetResultDto, { durationSeconds: 86401 }))).some(error => error.property === 'durationSeconds')).toBe(true);
  });
});
