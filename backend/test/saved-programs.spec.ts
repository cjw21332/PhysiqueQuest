import { describe, expect, it } from 'vitest';
import { savedProgramSchema } from '../src/coach/saved-program.schema.js';

const exercise = { exerciseId: 'pq-bench', name: 'Barbell Bench Press', targetMuscle: 'Chest', equipment: 'Barbell', sets: 3, unit: 'kg', restSets: 180, restNext: 180 };
const program = { id: 'prog_1', name: 'My Push Day', source: 'custom', days: [{ id: 'day_1', title: 'Push', weekday: 0, exercises: [exercise] }] };

describe('saved program validation', () => {
  it('accepts a program with optional reps and weight left blank', () => {
    expect(savedProgramSchema.safeParse(program).success).toBe(true);
    expect(savedProgramSchema.safeParse({ ...program, days: [{ ...program.days[0], exercises: [{ ...exercise, reps: '8-12', weight: 40 }] }] }).success).toBe(true);
  });
  it('rejects empty programs, unknown fields and out-of-range rest or sets', () => {
    expect(savedProgramSchema.safeParse({ ...program, days: [{ ...program.days[0], exercises: [] }] }).success).toBe(false);
    expect(savedProgramSchema.safeParse({ ...program, owner: 'someone-else' }).success).toBe(false);
    expect(savedProgramSchema.safeParse({ ...program, days: [{ ...program.days[0], exercises: [{ ...exercise, restSets: 900 }] }] }).success).toBe(false);
    expect(savedProgramSchema.safeParse({ ...program, days: [{ ...program.days[0], exercises: [{ ...exercise, sets: 11 }] }] }).success).toBe(false);
    expect(savedProgramSchema.safeParse({ ...program, id: '../x' }).success).toBe(false);
  });
});
