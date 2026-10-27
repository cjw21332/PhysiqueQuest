import { describe, expect, it } from 'vitest';
import { personalRecordDays } from './personal-records.js';

describe('personal record days', () => {
  it('requires improvement over an earlier workout and awards at most one day', () => {
    const session = (day: string, loads: number[]) => ({ userId: 'a', status: 'completed', endedAt: new Date(`${day}T12:00:00Z`), sets: loads.map(loadKg => ({ exerciseId: 'squat', status: 'completed', reps: 5, loadKg })) });
    expect([...personalRecordDays([session('2026-01-01', [20, 40]), session('2026-01-02', [30, 45, 50]), session('2026-01-02', [55])]).get('a')!]).toEqual(['2026-01-02']);
    expect(personalRecordDays([session('2026-01-01', [20, 40])]).size).toBe(0);
  });
});
