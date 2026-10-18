import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { CoachService as SavedCoachService } from '../src/coach/coach.service.js';

class CoachService extends SavedCoachService { constructor(profiles: any, settings: any, exercises: any) { super(profiles, settings, exercises, { findOne: () => ({ lean: () => ({ exec: async () => null }) }), findOneAndUpdate: (_filter: any, update: any) => ({ lean: () => ({ exec: async () => update.$setOnInsert }) }) } as any); } }

const USER = '507f1f77bcf86cd799439011';

const exercisesModel = (rows: unknown[]) =>
  ({ getForPlan: vi.fn(async () => rows.map((row: any) => ({ group: 'General', targetMuscle: '', equipment: '', instructions: [], ...row, pose: 'missing' }))) }) as any;

const profileModel = (profile: unknown) =>
  ({ findOne: vi.fn(() => ({ lean: () => ({ exec: async () => profile }) })) }) as any;

const settingsModel = (values: Record<string, unknown> | null = null) =>
  ({ findOne: vi.fn(() => ({ lean: () => ({ exec: async () => (values ? { values } : null) }) })) }) as any;

const library = (overrides: Partial<{ name: string; group: string; targetMuscle: string; equipment: string; pose: string }>[]) =>
  overrides.map((entry, index) => ({ _id: `507f1f77bcf86cd7994390${(index + 20).toString().padStart(2, '0')}`, pose: 'missing', ...entry }));

const profile = {
  goal: 'Build muscle',
  days: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
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

    expect(exercises.getForPlan).toHaveBeenCalledWith(['Dumbbells'], 'Build muscle');
    expect(plan.sessionCount).toBe(4);
    expect(plan.libraryReady).toBe(true);
    const workoutDays = plan.days.filter(day => day.isWorkoutDay);
    expect(workoutDays.map(day => day.index)).toEqual([0, 2, 4, 5]);
    expect(plan.days[6]).toMatchObject({ isWorkoutDay: false, title: 'Rest day' });
    for (const day of workoutDays) expect(day.exercises.length).toBeLessThanOrEqual(6);
    expect(workoutDays.flatMap(day => day.exercises).some(exercise => exercise.name.includes('Barbell'))).toBe(false);
    expect(workoutDays.flatMap(day => day.exercises).find(exercise => exercise.name === 'Dumbbell bench press')?.tracking).toBe('Manual');
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

  it('schedules workouts on the exact weekdays saved in the profile', async () => {
    const service = new CoachService(
      profileModel({ ...profile, days: ['Tuesday', 'Thursday', 'Sunday'] }),
      settingsModel(),
      exercisesModel([]),
    );

    const plan = await service.getPlan(USER);

    expect(plan.sessionCount).toBe(3);
    expect(plan.days.filter(day => day.isWorkoutDay).map(day => day.index)).toEqual([1, 3, 6]);
    expect(plan.days.map(day => day.name)).toEqual([
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    ]);
  });

  it('maps duplicate legacy day initials to distinct weekdays when possible', async () => {
    const service = new CoachService(
      profileModel({ ...profile, days: ['T', 'T', 'S', 'S'] }),
      settingsModel(),
      exercisesModel([]),
    );

    const plan = await service.getPlan(USER);

    expect(plan.days.filter(day => day.isWorkoutDay).map(day => day.index)).toEqual([1, 3, 5, 6]);
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

  it('keeps push/lower/pull days aligned with their program instead of rotating into unrelated muscles', async () => {
    const rows = library([
      { name: 'Dumbbell bench press', targetMuscle: 'Chest', equipment: 'Dumbbell' },
      { name: 'Overhead press', targetMuscle: 'Shoulders', equipment: 'Dumbbell' },
      { name: 'Triceps extension', targetMuscle: 'Arms', equipment: 'Dumbbell' },
      { name: 'Goblet squat', targetMuscle: 'Legs', equipment: 'Dumbbell' },
      { name: 'Bent-over row', targetMuscle: 'Back', equipment: 'Dumbbell' },
      { name: 'Biceps curl', targetMuscle: 'Arms', equipment: 'Dumbbell' },
      { name: 'Lateral raise', targetMuscle: 'Shoulders', equipment: 'Dumbbell' },
    ]);
    const plan = await new CoachService(profileModel(profile), settingsModel(), exercisesModel(rows)).getPlan(USER);
    const workoutDays = plan.days.filter(day => day.isWorkoutDay);
    expect(workoutDays[0].title).toBe('Upper Body — Push');
    expect(workoutDays[0].exercises.map(item => item.name)).toEqual(expect.arrayContaining(['Dumbbell bench press', 'Overhead press', 'Triceps extension']));
    expect(workoutDays[0].exercises.some(item => /squat|row|curl/i.test(item.name))).toBe(false);
    expect(workoutDays[1].exercises.map(item => item.name)).toEqual(['Goblet squat']);
    expect(workoutDays[2].exercises.map(item => item.name)).toEqual(expect.arrayContaining(['Bent-over row', 'Biceps curl']));
    expect(workoutDays[2].exercises.some(item => /press|squat|lateral/i.test(item.name))).toBe(false);
  });

  it('returns individual prescriptions and a form tip from the real catalog instructions', async () => {
    const rows = [{ _id: USER, name: 'Plank', targetMuscle: 'Core', equipment: 'Bodyweight', pose: 'missing', instructions: ['Keep hips level.'] }];
    const plan = await new CoachService(profileModel({ ...profile, goal: 'General fitness' }), settingsModel(), exercisesModel(rows)).getPlan(USER);
    const day = plan.days.find(item => item.isWorkoutDay)!;
    expect(day.exercises[0]).toMatchObject({ prescription: '3 × 45 s', equipment: 'Bodyweight', tracking: 'Manual' });
    expect(day.formTip).toEqual({ exerciseName: 'Plank', text: 'Keep hips level.' });
    expect(day.equipmentLabel).toBe('Bodyweight');
  });

  it('does not silently treat missing equipment as available or invent filler for an empty focus', async () => {
    const rows = library([{ name: 'Unknown equipment squat', targetMuscle: 'Legs' }, { name: 'Bench press', targetMuscle: 'Chest', equipment: 'Dumbbell' }]);
    const plan = await new CoachService(profileModel(profile), settingsModel(), exercisesModel(rows)).getPlan(USER);
    expect(plan.days[2].exercises).toEqual([]);
    expect(plan.days.flatMap(item => item.exercises).some(item => item.name === 'Unknown equipment squat')).toBe(false);
  });

  it('keeps distinct core exercises for a core-focused program', async () => {
    const rows = library(['Plank', 'Bird dog', 'Dead bug'].map(name => ({ name, targetMuscle: 'Core', equipment: 'Bodyweight' })));
    const plan = await new CoachService(profileModel({ ...profile, goal: 'General fitness' }), settingsModel(), exercisesModel(rows)).getPlan(USER);
    const core = plan.days.find(day => day.title === 'Core & Mobility')!;
    expect(core.exercises.map(item => item.name)).toEqual(expect.arrayContaining(['Plank', 'Bird dog', 'Dead bug']));
    expect(core.exercises).toHaveLength(3);
  });
});
