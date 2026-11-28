import { lifecycleModel } from './lifecycle-model.fixture.js';
import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { CoachService } from '../src/coach/coach.service.js';
vi.mock('../src/coach/openai-plan.js', () => ({ orderPlanWithOpenAI: async (plan: unknown) => plan }));

const user = '507f1f77bcf86cd799439011';
const otherUser = '507f1f77bcf86cd799439012';
const profile = { goal: 'Build muscle', days: ['M', 'T', 'W', 'T', 'F'], duration: '60 min', equipment: ['Dumbbells'], conditions: [] };
function setup() {
  let current = { ...profile };
  const records = new Map<string, any>();
  const key = (query: any) => `${query.userId}:${query.contextHash}`;
  const query = (read: () => any) => ({ lean: () => ({ exec: async () => read() }) });
  const programs = {
    findOne: vi.fn(filter => query(() => records.get(key(filter)) ?? null)),
    findOneAndUpdate: vi.fn((filter, update) => {
      const write = () => {
        if (!records.has(key(filter))) records.set(key(filter), { _id: `saved-${records.size}`, ...update.$setOnInsert, ...filter, createdAt: new Date() });
        if (update.$set) Object.assign(records.get(key(filter)), update.$set);
        return records.get(key(filter));
      };
      return { ...query(write), exec: async () => write() };
    }),
  };
  const provider = { getForPlan: vi.fn(async () => [{ _id: 'provider-bench', name: 'Dumbbell bench press', group: 'Chest', targetMuscle: 'Chest', equipment: 'Dumbbell', pose: 'missing', instructions: ['Keep wrists straight.'], gifUrl: 'https://example.com/fresh.gif' }]) };
  const profiles = { findOne: () => query(() => current) };
  const settings = { findOne: () => query(() => null) };
  const feedback = { list: vi.fn(async (_user: string, _limit: number): Promise<any[]> => []) };
  const service = () => new CoachService(profiles as any, settings as any, provider as any, lifecycleModel(programs as any), feedback as any);
  return { service, feedback, provider, programs, records, change: (patch: any) => { current = { ...current, ...patch }; } };
}

describe('saved per-user Coach programs', () => {
  it('keeps the same exercises and only adjusts sets, reps and tips from the owner feedback', async () => {
    const test = setup(), service = test.service();
    const exercise = 'Dumbbell bench press';
    const original = await service.getPlan(user);
    expect(original.days[0].exercises[0].prescription).toBe('4 × 10');
    test.feedback.list.mockResolvedValue([{ exercise, difficulty: 'too_easy', rpe: 4 }]);
    const easy = await service.getPlan(user);
    expect(easy.programVersion).toBe(original.programVersion);
    expect(easy.days[0].exercises.map((item: any) => item.name)).toEqual(original.days[0].exercises.map((item: any) => item.name));
    expect(easy.days[0].exercises[0].prescription).toBe('4 × 12');
    expect(easy.days[0].exercises[0].feedbackTip).toMatch(/two more reps/);
    test.feedback.list.mockResolvedValue([{ exercise, difficulty: 'just_right', rpe: 9 }]);
    const hard = (await service.getPlan(user)).days[0].exercises[0];
    expect(hard.prescription).toBe('3 × 10');
    expect(hard.feedbackTip).toMatch(/one fewer set/);
    test.feedback.list.mockResolvedValue([{ exercise, difficulty: 'too_hard', rpe: 9, painLocations: ['shoulder'], notes: 'private note' }]);
    const painful = await service.getPlan(user);
    expect(painful.days[0].exercises[0].name).toBe(original.days[0].exercises[0].name);
    expect(painful.days[0].exercises[0].prescription).toBe('2 × 10');
    expect(painful.days[0].exercises[0].feedbackTip).toMatch(/pain-free range/);
    expect(JSON.stringify(painful)).not.toMatch(/shoulder|private note/i);
    expect(test.feedback.list).toHaveBeenCalledWith(user, 20);
  });

  it('applies preventive age limits from 35 and reviews an unrecognized consented restriction', async () => {
    const test = setup(), service = test.service();
    test.change({ age: '34' });
    expect((await service.getPlan(user)).days[0].exercises[0].prescription).toBe('4 × 10');
    // From 35 sets are capped at 3; the plan says why.
    test.change({ age: '35' });
    const capped = await service.getPlan(user);
    expect(capped.days[0].exercises[0].prescription).toBe('3 × 10');
    expect(capped.ageNote).toContain('35+');
    test.change({ healthConsentAt: new Date(), injuries: ['other restriction'] });
    expect((await service.getPlan(user)).days[0]).toMatchObject({ availabilityNote: expect.stringContaining('needs review') });
  });

  it('saves an edited day for its owner and reloads it without changing another account', async () => {
    const test = setup(), service = test.service();
    const first = await service.getPlan(user);
    await service.getPlan(otherUser);
    const exercise = { exerciseId: 'custom-one', name: 'My exercise', group: 'Back', targetMuscle: 'Back', equipment: 'Dumbbells', tracking: 'Manual', prescription: '3 × 10' };
    await service.updateDay(user, { programVersion: first.programVersion, dayIndex: 0, title: 'Pull', exercises: [exercise] });
    expect((await test.service().getPlan(user)).days[0]).toMatchObject({ title: 'Pull', exercises: [exercise] });
    expect((await test.service().getPlan(otherUser)).days[0].title).not.toBe('Pull');
    await service.updateDay(user, { programVersion: first.programVersion, dayIndex: 0, title: 'Rest', exercises: [] });
    expect((await service.getPlan(user)).days[0]).toMatchObject({ title: 'Rest', exercises: [], isWorkoutDay: false });
  });
  it('replaces the whole week from a program: listed days become sessions, the rest become rest days', async () => {
    const test = setup(), service = test.service();
    const first = await service.getPlan(user);
    const row = (id: string) => ({ exerciseId: id, name: id, group: 'Legs', targetMuscle: 'Quads', equipment: 'Machine', tracking: 'Manual' as const, prescription: '3 × 8-10 @ 70 kg' });
    const week = await service.replaceWeek(user, { programVersion: first.programVersion, days: [{ dayIndex: 0, title: 'Push', exercises: [row('bench')] }, { dayIndex: 4, title: 'Lower', exercises: [row('deadlift'), row('leg-press')] }] });
    expect(week.days.map((day: any) => [day.title, day.isWorkoutDay])).toEqual([['Push', true], ['Recovery day', false], ['Recovery day', false], ['Recovery day', false], ['Lower', true], ['Recovery day', false], ['Rest day', false]]);
    expect(week.sessionCount).toBe(2);
    expect((await test.service().getPlan(user)).days[4].exercises.map((item: any) => item.exerciseId)).toEqual(['deadlift', 'leg-press']);
    await expect(service.replaceWeek(user, { programVersion: first.programVersion, days: [{ dayIndex: 0, title: 'A', exercises: [] }, { dayIndex: 0, title: 'B', exercises: [] }] })).rejects.toThrow();
    await expect(service.replaceWeek(user, { programVersion: first.programVersion, days: [] })).rejects.toThrow();
  });
  it('never stores feedback adjustments when a day is edited', async () => {
    const test = setup(), service = test.service();
    const first = await service.getPlan(user);
    test.feedback.list.mockResolvedValue([{ exercise: 'Dumbbell bench press', difficulty: 'too_hard', rpe: 9 }]);
    await service.updateDay(user, { programVersion: first.programVersion, dayIndex: 1, title: 'Arms', exercises: [] });
    const stored = [...test.records.values()][0].plan.days[0].exercises[0];
    expect(stored.prescription).toBe('4 × 10');
    expect(stored.feedbackTip ?? null).toBeNull();
    expect((await service.getPlan(user)).days[0].exercises[0].prescription).toBe('3 × 10');
  });
  it('rejects malformed, duplicate and stale edits', async () => {
    const test = setup(), service = test.service();
    const first = await service.getPlan(user);
    const exercise = { exerciseId: 'one', name: 'Row', group: 'Back', targetMuscle: 'Back', equipment: '', tracking: 'Manual' };
    await expect(service.updateDay(user, { programVersion: first.programVersion, dayIndex: 0, title: 'Pull', exercises: [exercise, exercise] })).rejects.toThrow();
    test.change({ goal: 'Strength' });
    await expect(service.updateDay(user, { programVersion: first.programVersion, dayIndex: 0, title: 'Pull', exercises: [exercise] })).rejects.toThrow('plan changed');
  });
  it('persists daily prescriptions and reuses them after service restart without provider calls', async () => {
    const test = setup();
    const first = await test.service().getPlan(user);
    const second = await test.service().getPlan(user);
    expect(second.days).toEqual(first.days);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(1);
    expect(test.records.size).toBe(1);
    const saved = [...test.records.values()][0].plan;
    expect(saved.days[0].exercises[0]).toMatchObject({ exerciseId: 'provider-bench', prescription: '4 × 10' });
    expect(saved.days[0].exercises[0]).not.toHaveProperty('gifUrl');
  });

  it('deduplicates concurrent loads for the same user', async () => {
    const test = setup(), service = test.service();
    const plans = await Promise.all([service.getPlan(user), service.getPlan(user), service.getPlan(user)]);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(1);
    expect(plans[0].days).toEqual(plans[2].days);
  });

  it('isolates users and regenerates only for changed program preferences', async () => {
    const test = setup(), service = test.service();
    await service.getPlan(user);
    test.change({ name: 'Changed display name', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] });
    await service.getPlan(user);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(1);
    await service.getPlan(otherUser);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(2);
    test.change({ conditions: ['Shoulder impingement'] });
    await service.getPlan(user);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(3);
    test.change({ duration: '20 min' });
    expect((await service.getPlan(user)).duration).toBe('20 min');
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(4);
  });

  it.each([
    { goal: 'Strength' },
    { days: ['Tuesday', 'Saturday'] },
    { equipment: ['Full gym'] },
  ])('generates a replacement when program preferences change: %j', async patch => {
    const test = setup(), service = test.service();
    await service.getPlan(user);
    test.change(patch);
    await service.getPlan(user);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(2);
    expect(test.records.size).toBe(2);
    await service.getPlan(user);
    expect(test.provider.getForPlan).toHaveBeenCalledTimes(2);
  });

  it('serves a saved program during a provider outage and does not save empty generations', async () => {
    const test = setup(), service = test.service();
    await service.getPlan(user);
    test.provider.getForPlan.mockRejectedValue(new Error('Provider unavailable'));
    expect((await test.service().getPlan(user)).libraryReady).toBe(true);
    test.change({ goal: 'Strength' });
    await expect(service.getPlan(user)).rejects.toThrow('Provider unavailable');
    test.provider.getForPlan.mockResolvedValue([]);
    expect((await service.getPlan(user)).libraryReady).toBe(false);
    expect(test.records.size).toBe(1);
  });
});

describe('coach planner adaptation signals', () => {
  it('caps prescriptions by age band', async () => {
    const { limitPrescription } = await import('../src/coach/coach-planner.js');
    expect(limitPrescription('4 × 6', 'under35')).toBe('4 × 6');
    expect(limitPrescription('4 × 6', '35to49')).toBe('3 × 8');
    expect(limitPrescription('4 × 6', '50to64')).toBe('3 × 10');
    expect(limitPrescription('3 × 45 s at easy effort', '65plus')).toBe('3 × 30 s at easy effort');
    expect(limitPrescription('2 × 8 at easy effort', '65plus')).toBe('2 × 10 at easy effort');
  });

  it('leaves out high-impact moves from 50 and keeps exercises in the plan', async () => {
    const { CoachPlanner } = await import('../src/coach/coach-planner.js');
    const library = [
      { id: 'burpee', name: 'Burpee', group: 'Cardio', targetMuscle: 'cardiovascular system', equipment: 'Body weight', pose: 'missing', instructions: [] },
      { id: 'walk', name: 'Brisk walk', group: 'Cardio', targetMuscle: 'cardiovascular system', equipment: 'Body weight', pose: 'missing', instructions: [] },
    ];
    const base = { goal: 'Endurance', days: ['M', 'T', 'W'], duration: '45 min', equipment: [] as string[] };
    const names = (age: string) => new CoachPlanner().build({ ...base, age }, library).days.flatMap(day => day.exercises.map(exercise => exercise.name));
    expect(names('30')).toContain('Burpee');
    expect(names('50')).not.toContain('Burpee');
    expect(new CoachPlanner().build({ ...base, age: '60' }, library).sets).toBe(new CoachPlanner().build({ ...base, age: '30' }, library).sets);
  });

  it('never regenerates the program because of workout feedback', async () => {
    const { coachProgramContext } = await import('../src/coach/coach.service.js');
    const hash = (rpe: number, pain = false) => coachProgramContext(profile as any, {}, [{ exercise: 'Row', rpe, difficulty: 'just_right', pain }]).contextHash;
    const none = coachProgramContext(profile as any, {}, []).contextHash;
    expect([hash(6), hash(9), hash(9, true)]).toEqual([none, none, none]);
  });
});
