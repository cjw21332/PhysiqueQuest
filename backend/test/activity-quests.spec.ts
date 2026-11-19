import { lifecycleModel } from './lifecycle-model.fixture.js';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ActivityService } from '../src/activity/activity.service.js';
import { UpdateActivityDto } from '../src/activity/dto/activity.dto.js';

describe('activity quest authority', () => {
  const users = { findById: () => ({ select: () => ({ lean: () => ({ exec: async () => ({ createdAt: new Date('2026-01-01') }) }) }) }) } as any;
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
    const nutrition = { read: async () => ({ meals: ['a', 'b', 'c'].map(scanGroupId => ({ date, scanGroupId, scanSavedAt: new Date() })), water: [{ date, glasses: 8 }] }) } as any;
    const workouts = { creditHistory: async () => [{ status: 'completed', endedAt: new Date() }], personalRecordDays: async () => [date] } as any;
    const result = await new ActivityService(lifecycleModel(activityModel), nutrition, workouts, { get: async () => ({ self: { rank: 2, points: 100 } }) } as any, users).get('507f1f77bcf86cd799439011');
    expect(result.badges).toHaveLength(8);
    expect(result.badges.find(badge => badge.id === 'top-10')?.earned).toBe(true);
    expect(result.dailyMissions.every(mission => mission.complete)).toBe(true);
    expect(result.state.questProgress).toEqual({ workout: 1, meals: 3, water: 8 });
  });
  it('counts one saved scan per meal and ignores manual entries and unsaved scans', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const meals: any[] = [{ id: 'manual', date }];
    const activityModel = { findOne: () => ({ exec: async () => ({ state: { timezone: 'UTC' } }) }) } as any;
    const nutrition = { read: async () => ({ meals, water: [] }) } as any;
    const workouts = { creditHistory: async () => [], personalRecordDays: async () => [] } as any;
    const service = new ActivityService(lifecycleModel(activityModel), nutrition, workouts, { get: async () => ({ self: { rank: 1, points: 0 } }) } as any, users);
    const progress = async () => (await service.get('507f1f77bcf86cd799439011')).dailyMissions.find(mission => mission.key === 'meals')!;
    expect((await progress()).progress).toBe(0);
    meals.push({ date, id: 'one-a', scanGroupId: 'one', scanSavedAt: new Date() }, { date, id: 'one-b', scanGroupId: 'one', scanSavedAt: new Date() });
    expect((await progress()).progress).toBe(1);
    meals.push({ date, scanGroupId: 'two', scanSavedAt: new Date() }, { date, scanGroupId: 'three', scanSavedAt: new Date() });
    expect(await progress()).toMatchObject({ progress: 3, complete: true });
  });

  it('derives the reference badges from saved evidence and marks form unavailable', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const activityModel = { findOne: () => ({ exec: async () => ({ state: { timezone: 'UTC' } }) }) } as any;
    const nutrition = { read: async () => ({ meals: [{ date, protein: 140, carbs: 240, fat: 70 }], water: [{ date, glasses: 8 }] }) } as any;
    const workouts = { creditHistory: async () => [{ status: 'completed', endedAt: new Date(), earlyBird: true }], personalRecordDays: async () => [date] } as any;
    const result = await new ActivityService(lifecycleModel(activityModel), nutrition, workouts, { get: async () => ({ self: { rank: 2, points: 100 } }) } as any, users).get('507f1f77bcf86cd799439011');
    for (const id of ['first-pr', 'hydrated', 'macro-master', 'top-10', 'early-bird']) expect(result.badges.find(badge => badge.id === id)?.earned).toBe(true);
    expect(result.badges.find(badge => badge.id === 'perfect-form')).toMatchObject({ earned: false, available: false });
  });
});
