import { describe, expect, it, vi } from 'vitest';
import { curatedDetail, curatedExercises } from '../src/exercises/curated-catalog.js';
import { ExerciseDbService } from '../src/exercises/exercisedb.service.js';
import { CoachPlanner } from '../src/coach/coach-planner.js';

describe('expanded PhysiqueQuest exercises', () => {
  it('publishes 50 distinct manual entries with instructions and stable detail IDs', () => {
    const all = curatedExercises();
    expect(all).toHaveLength(50);
    expect(new Set(all.map(item => item._id)).size).toBe(50);
    for (const item of all) {
      expect(item).toMatchObject({ source: 'PhysiqueQuest', pose: 'missing', trackingStatus: 'Manual', gifUrl: '' });
      expect(item.instructions.length).toBeGreaterThanOrEqual(2);
      expect(curatedDetail(item._id).name).toBe(item.name);
    }
    expect(() => curatedDetail('pq-missing')).toThrow('Exercise not found');
  });
  it('combines source search, equipment, muscle and pagination without remote requests', async () => {
    const service = new ExerciseDbService();
    const first = await service.findAll({ source: 'physiquequest', limit: 12 });
    const second = await service.findAll({ source: 'physiquequest', page: 2, limit: 12 });
    expect(first).toMatchObject({ total: 50, pages: 5, source: 'PhysiqueQuest' });
    expect(second.items.every(item => !first.items.some(previous => previous._id === item._id))).toBe(true);
    const pushups = await service.findAll({ source: 'physiquequest', search: 'push ups', muscle: 'Chest', equipment: 'Bodyweight only' });
    expect(pushups.items.map(item => item.name)).toEqual(['Knee push-up', 'Push-up', 'Wall push-up']);
    expect((await service.findAll({ source: 'physiquequest', search: 'push-up', equipment: 'Barbell' })).total).toBe(0);
    expect((await service.findBySlug('pq-wall-push-up')).source).toBe('PhysiqueQuest');
  });
  it('expands new-plan candidates without extra provider calls or duplicate names', async () => {
    const service = new ExerciseDbService();
    const upstream = { ...curatedDetail('pq-push-up'), _id: 'real-provider-pushup', source: 'ExerciseDB V1' };
    const calls = vi.spyOn(service, 'findAll').mockResolvedValue({ items: [upstream], total: 1, page: 1, limit: 100, pages: 1, source: 'ExerciseDB V1', coverageNote: undefined });
    const candidates = await service.getForPlan(['Bodyweight only'], 'General fitness');
    expect(calls).toHaveBeenCalledTimes(6);
    expect(candidates.every(row => row.equipment === 'Bodyweight')).toBe(true);
    expect(candidates.filter(row => row.name === 'Push-up')).toHaveLength(1);
    expect(candidates.some(row => row.name === 'Bodyweight squat')).toBe(true);
    const plan = new CoachPlanner().build({ goal: 'General fitness', equipment: ['Bodyweight only'], days: ['Monday'], duration: '45 min', conditions: [] }, candidates.map(row => ({ ...row, id: row._id })));
    const day = plan.days.find(row => row.isWorkoutDay)!;
    expect(day.exercises.length).toBeGreaterThanOrEqual(4);
    expect(day.exercises.every(row => row.tracking === 'Manual')).toBe(true);
    expect(day.exercises.some(row => row.name === 'Bodyweight squat')).toBe(true);
  });
});
