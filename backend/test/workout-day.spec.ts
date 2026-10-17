import { BadRequestException } from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { WorkoutsService } from '../src/workouts/workouts.service.js';
import type { WorkoutSession } from '../src/workouts/schemas/workout-session.schema.js';
import { activityDate, plannedDayResults, setProgress, shiftCalendarDate, validCalendarDate, workoutCalendarDate } from '../src/workouts/workout-contract.js';

const owner = '507f1f77bcf86cd799439011';
const planned = { _id: 'planned', startedAt: '2026-10-17T03:00:00Z', status: 'completed' as const, exerciseIds: ['curl'], origin: 'planned' as const, dayIndex: 0, timezone: 'Asia/Taipei', programVersion: 'current', sets: [{ setId: 'curl:0', exerciseId: 'curl', setIndex: 0, status: 'completed' as const, source: 'manual' as const, reps: 10 }] };

describe('workout calendar isolation and remaining sets', () => {
  it('keeps a planned Monday session in the selected week even when performed on Saturday', () => {
    expect(workoutCalendarDate(planned)).toBe('2026-10-12');
    expect(workoutCalendarDate({ ...planned, startedAt: '2026-10-10T03:00:00Z' })).toBe('2026-10-05');
    expect(workoutCalendarDate({ ...planned, startedAt: '2026-10-19T03:00:00Z', scheduledDate: '2026-10-12' })).toBe('2026-10-12');
  });
  it('uses the actual performed date for recordings and frozen dates for overnight sessions', () => {
    expect(workoutCalendarDate({ ...planned, origin: 'recorded-set', startedAt: '2026-10-16T17:00:00Z', activityDate: '2026-10-17' })).toBe('2026-10-17');
    expect(workoutCalendarDate({ ...planned, origin: 'standalone', activityDate: '2026-10-18' })).toBe('2026-10-18');
    expect(workoutCalendarDate({ ...planned, origin: undefined, dayIndex: undefined, timezone: undefined }, 'America/New_York')).toBe('2026-10-16');
  });
  it('uses calendar arithmetic across daylight-saving transitions and rejects invalid dates', () => {
    expect(shiftCalendarDate('2026-11-01', 1)).toBe('2026-11-02');
    expect(shiftCalendarDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(validCalendarDate('2026-02-30')).toBe(false);
    expect(validCalendarDate('2026-2-3')).toBe(false);
    expect(workoutCalendarDate({ ...planned, timezone: 'America/New_York', dayIndex: 6, startedAt: '2026-11-02T01:00:00Z' })).toBe('2026-11-01');
    expect(activityDate('2026-11-02T01:00:00Z', 'America/New_York')).toBe('2026-11-01');
  });
  it('never applies another weekday, week, program or standalone recording to planned progress', () => {
    const rows = [planned, { ...planned, dayIndex: 2 }, { ...planned, startedAt: '2026-10-05T03:00:00Z' }, { ...planned, programVersion: 'old' }, { ...planned, origin: 'recorded-set' as const }];
    expect(plannedDayResults(rows, 'current', 0, '2026-10-12')).toEqual(planned.sets);
    expect(plannedDayResults(rows, 'current', 0, '2026-10-19')).toEqual([]);
  });
  it('counts unique prescribed slots and distinguishes skipped from completed and remaining', () => {
    const exercise = [{ exerciseId: 'curl', sets: 3 }];
    const completed = planned.sets[0];
    const skipped = { ...completed, setIndex: 1, status: 'skipped' as const };
    expect(setProgress(exercise, [completed, completed, skipped, { ...completed, exerciseId: 'other' }, { ...completed, setIndex: 99 }])).toEqual({ total: 3, completed: 1, skipped: 1, reviewed: 2, remaining: 1 });
    expect(setProgress(exercise, [completed, skipped, { ...completed, setIndex: 1 }, { ...completed, setIndex: 2 }])).toEqual({ total: 3, completed: 3, skipped: 0, reviewed: 3, remaining: 0 });
  });
  it('loads all matching day records without the recent-history cap and scopes the query to the owner', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ ...planned, _id: String(index), startedAt: new Date(planned.startedAt) }));
    rows.push({ ...rows[0], dayIndex: 2 }, { ...rows[0], startedAt: new Date('2026-10-05T03:00:00Z') });
    const find = vi.fn((_filter: any) => ({ sort: () => ({ lean: () => ({ exec: async () => rows }) }) }));
    const service = new WorkoutsService({ find } as unknown as Model<WorkoutSession>);
    expect(await service.forDay(owner, '2026-10-12', 'Asia/Taipei')).toHaveLength(25);
    expect(find.mock.calls[0][0].userId).toEqual(new Types.ObjectId(owner));
    expect(find.mock.calls[0][0].$or[1].startedAt.$gte).toBeInstanceOf(Date);
    expect(find.mock.calls[0][0].$or).toContainEqual({ activityDate: '2026-10-12' });
    expect(find.mock.calls[0][0].$or).toContainEqual({ scheduledDate: '2026-10-12' });
  });
  it('rejects invalid dates and timezones before accessing the database', async () => {
    const find = vi.fn();
    const service = new WorkoutsService({ find } as unknown as Model<WorkoutSession>);
    await expect(service.forDay(owner, '2026-02-30')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.forDay(owner, '2026-10-12', 'Invalid/Zone')).rejects.toBeInstanceOf(BadRequestException);
    expect(find).not.toHaveBeenCalled();
  });
  it('rejects mismatched, impossible or standalone scheduled dates before writing', async () => {
    const create = vi.fn();
    const service = new WorkoutsService({ create } as unknown as Model<WorkoutSession>);
    const input = { origin: 'planned' as const, exerciseIds: ['curl'], exercises: [{ exerciseId: 'curl', name: 'Curl', equipment: '', sets: 3 }], startedAt: planned.startedAt, dayIndex: 0 };
    await expect(service.create(owner, { ...input, scheduledDate: '2026-10-14' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(owner, { ...input, scheduledDate: '2026-02-30' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(owner, { ...input, origin: 'standalone', scheduledDate: '2026-10-12' })).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
  it('persists an explicit selected date independently of the actual performed date', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-19T04:00:00Z'));
    try {
    const create = vi.fn(async (value: any) => value);
    const service = new WorkoutsService({ create } as unknown as Model<WorkoutSession>);
    const saved = await service.create(owner, { origin: 'planned', exerciseIds: ['curl'], exercises: [{ exerciseId: 'curl', name: 'Curl', equipment: '', sets: 3 }], startedAt: '2026-10-19T03:00:00Z', dayIndex: 0, scheduledDate: '2026-10-12', timezone: 'Asia/Taipei' });
    expect(saved.scheduledDate).toBe('2026-10-12');
    expect(saved.startedAt).toEqual(new Date('2026-10-19T03:00:00Z'));
    } finally { now.mockRestore(); }
  });
});
