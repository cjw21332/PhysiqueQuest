import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ActivityService } from '../src/activity/activity.service.js';
import { UpdateActivityDto } from '../src/activity/dto/activity.dto.js';

describe('activity quest authority', () => {
  it('accepts only a timezone preference, never client quest rewards', async () => {
    const dto = plainToInstance(UpdateActivityDto, { state: { timezone: 'Asia/Singapore', questProgress: { workout: 99 }, level: 50, badges: ['admin'] } });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some(error => error.property === 'state')).toBe(true);
  });
  it('accepts a valid timezone preference', async () => {
    const dto = plainToInstance(UpdateActivityDto, { state: { timezone: 'Asia/Singapore' } });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
  });

  it('derives mission completion only from persisted meals, water, and workouts', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const record = { state: { timezone: 'UTC' } };
    const activityModel = { findOne: () => ({ exec: async () => record }) } as any;
    const nutrition = { read: async () => ({ meals: [{ date }, { date }, { date }], water: [{ date, glasses: 8 }] }) } as any;
    const workouts = { creditHistory: async () => [{ status: 'completed', endedAt: new Date() }] } as any;
    const result = await new ActivityService(activityModel, nutrition, workouts).get('507f1f77bcf86cd799439011');
    expect(result.dailyMissions.every(mission => mission.complete)).toBe(true);
    expect(result.state.questProgress).toEqual({ workout: 1, meals: 3, water: 8 });
  });
});
