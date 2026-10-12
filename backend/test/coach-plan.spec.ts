import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { CoachService } from '../src/coach/coach.service.js';

const USER = '507f1f77bcf86cd799439011';

const exercisesModel = (rows: unknown[]) =>
  ({ find: vi.fn(() => ({ select: () => ({ lean: () => ({ exec: async () => rows }) }) })) }) as any;

const profileModel = (profile: unknown) =>
  ({ findOne: vi.fn(() => ({ lean: () => ({ exec: async () => profile }) })) }) as any;

const settingsModel = (values: Record<string, unknown> | null = null) =>
  ({ findOne: vi.fn(() => ({ lean: () => ({ exec: async () => (values ? { values } : null) }) })) }) as any;

const library = (overrides: Partial<{ name: string; group: string; targetMuscle: string; equipment: string; pose: string }>[]) =>
  overrides.map((entry, index) => ({ _id: `507f1f77bcf86cd7994390${(index + 20).toString().padStart(2, '0')}`, pose: 'missing', ...entry }));

const profile = {
  goal: 'Build muscle',
  days: ['M', 'W', 'F', 'S'],
  duration: '45 min',
  equipment: ['Dumbbells'],
  conditions: [] as string[],
};

describe('coach plan', () => {
  it('builds a scheduled week from the published library for the profile equipment', async () => {
    const rows = library([
      { name: 'Dumbbell bench press', group: 'Chest', targetMuscle: 'chest', equipment: 'Dumbbells', pose: 'ready' },
      { name: 'Dumbbell row', group: 'Back', targetMuscle: 'back', equipment: 'Dumbbells' },
      { name: 'Dumbbell shoulder press', group: 'Shoulders', targetMuscle: 'shoulder', equipment: 'Dumbbells' },
      { name: 'Goblet squat', group: 'Legs', targetMuscle: 'leg', equipment: 'Dumbbells' },
      { name: 'Romanian deadlift', group: 'Legs', targetMuscle: 'hamstring', equipment: 'Dumbbells' },
      { name: 'Biceps curl', group: 'Arms', targetMuscle: 'biceps', equipment: 'Dumbbells' },
      { name: 'Plank', group: 'Core', targetMuscle: 'core', equipment: 'Bodyweight' },
      { name: 'Barbell back squat', group: 'Legs', targetMuscle: 'leg', equipment: 'Barbell' },
    ]);
    const exercises = exercisesModel(rows);
    const service = new CoachService(profileModel(profile), settingsModel(), exercises);

    const plan = await service.getPlan(USER);

    expect(exercises.find).toHaveBeenCalledWith({ status: 'published' });
    expect(plan.sessionCount).toBe(4);
    expect(plan.libraryReady).toBe(true);
    const workoutDays = plan.days.filter(day => day.isWorkoutDay);
    expect(workoutDays.map(day => day.index)).toEqual([0, 2, 4, 5]);
    expect(plan.days[6]).toMatchObject({ isWorkoutDay: false, title: 'Rest day' });
    for (const day of workoutDays) expect(day.exercises).toHaveLength(5);
    expect(workoutDays.flatMap(day => day.exercises).some(exercise => exercise.name.includes('Barbell'))).toBe(false);
    expect(workoutDays.flatMap(day => day.exercises).find(exercise => exercise.name === 'Dumbbell bench press')?.tracking).toBe('AI tracked');
  });

  it('keeps exercises that conflict with a health condition out of the plan', async () => {
    const rows = library([
      { name: 'Overhead press', group: 'Shoulders', targetMuscle: 'shoulder', equipment: 'Dumbbells' },
      { name: 'Dumbbell row', group: 'Back', targetMuscle: 'back', equipment: 'Dumbbells' },
      { name: 'Biceps curl', group: 'Arms', targetMuscle: 'biceps', equipment: 'Dumbbells' },
    ]);
    const service = new CoachService(profileModel({ ...profile, conditions: ['Shoulder impingement'] }), settingsModel(), exercisesModel(rows));

    const plan = await service.getPlan(USER);

    expect(plan.days.flatMap(day => day.exercises).some(exercise => exercise.name === 'Overhead press')).toBe(false);
  });

  it('flags an empty published library instead of inventing exercises', async () => {
    const service = new CoachService(profileModel(profile), settingsModel(), exercisesModel([]));

    const plan = await service.getPlan(USER);

    expect(plan.libraryReady).toBe(false);
    expect(plan.days.flatMap(day => day.exercises)).toEqual([]);
  });

  it('rejects a user without a profile', async () => {
    const service = new CoachService(profileModel(null), settingsModel(), exercisesModel([]));
    await expect(service.getPlan(USER)).rejects.toThrow();
  });
});
