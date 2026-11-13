import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { WorkoutsService } from '../src/workouts/workouts.service.js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetResultDto, UpdateRoutineDto } from '../src/workouts/dto/workout.dto.js';

const user = '507f1f77bcf86cd799439011', id = '507f1f77bcf86cd799439012';
function setup() {
  const workout = { _id: id, status: 'active', revision: 2, exercises: [{ exerciseId: 'a', name: 'Squat', sets: 2 }, { exerciseId: 'b', name: 'Row', sets: 2 }], sets: [{ setId: 'a:0', exerciseId: 'a', setIndex: 0, status: 'completed' }] };
  const deleteOne = vi.fn().mockResolvedValue({ deletedCount: 1 });
  const service = new WorkoutsService({ deleteOne } as never, {} as never);
  vi.spyOn(service as any, 'owned').mockResolvedValue(workout);
  const change = vi.spyOn(service as any, 'change').mockImplementation(async (_user, _id, _revision, patch) => ({ ...workout, ...patch }));
  return { service, change, deleteOne };
}
const entry = (exerciseId: string) => ({ exerciseId, restBetweenSets: 45, restAfterExercise: 90 });
describe('editing an active workout routine', () => {
  it('cancels only the owned active revision and does not complete the workout', async () => {
    const { service, change, deleteOne } = setup();
    await expect(service.cancel(user, id, 1)).rejects.toThrow();
    expect(deleteOne).not.toHaveBeenCalled();
    await expect(service.cancel(user, id, 2)).resolves.toEqual({ cancelled: true });
    expect(deleteOne).toHaveBeenCalledWith(expect.objectContaining({ _id: id, status: 'active', revision: 2, userId: expect.anything() }));
    expect(change).not.toHaveBeenCalled();
    deleteOne.mockResolvedValueOnce({ deletedCount: 0 });
    await expect(service.cancel(user, id, 2)).rejects.toThrow('changed');
  });
  it('persists names and extra sets without changing logged results', async () => {
    const { service, change } = setup();
    await service.updateRoutine(user, id, { expectedRevision: 2, routineName: ' Upper body ', exercises: [{ ...entry('a'), name: 'My squat', sets: 3 }, entry('b')] });
    expect(change).toHaveBeenCalledWith(user, id, 2, expect.objectContaining({ routineName: 'Upper body', exercises: [expect.objectContaining({ name: 'My squat', sets: 3 }), expect.anything()] }));
    expect(change.mock.calls[0][3]).not.toHaveProperty('sets');
  });
  it('replaces only an unlogged exercise with a complete snapshot', async () => {
    const { service } = setup();
    const replacement = { ...entry('c'), name: 'Pulldown', equipment: 'Cable', sets: 3 };
    const saved = await service.updateRoutine(user, id, { expectedRevision: 2, exercises: [entry('a'), replacement] });
    expect(saved.exerciseIds).toEqual(['a', 'c']);
    await expect(service.updateRoutine(user, id, { expectedRevision: 2, exercises: [replacement, entry('b')] })).rejects.toThrow('saved sets');
  });
  it('validates blank names and set limits', async () => {
    for (const patch of [{ routineName: '   ' }, { exercises: [{ ...entry('a'), sets: 11 }] }]) {
      expect(await validate(plainToInstance(UpdateRoutineDto, { expectedRevision: 2, exercises: [entry('a')], ...patch }))).not.toHaveLength(0);
    }
  });
  it('persists the requested order and per-exercise rest while preserving snapshots', async () => {
    const { service, change } = setup();
    await service.updateRoutine(user, id, { expectedRevision: 2, exercises: [entry('b'), entry('a')] });
    expect(change).toHaveBeenCalledWith(user, id, 2, expect.objectContaining({ exerciseIds: ['b', 'a'], exercises: [expect.objectContaining({ name: 'Row', restBetweenSets: 45, restAfterExercise: 90 }), expect.objectContaining({ name: 'Squat' })] }));
  });
  it('rejects unknown, duplicate, stale, and removal of exercises with saved sets', async () => {
    const { service, change } = setup();
    for (const exercises of [[entry('x')], [entry('a'), entry('a')], [entry('b')]]) await expect(service.updateRoutine(user, id, { expectedRevision: 2, exercises })).rejects.toThrow();
    await expect(service.updateRoutine(user, id, { expectedRevision: 1, exercises: [entry('a')] })).rejects.toThrow();
    expect(change).not.toHaveBeenCalled();
  });
  it('validates bounded rest settings and set types', async () => {
    expect(await validate(plainToInstance(UpdateRoutineDto, { expectedRevision: 2, exercises: [{ ...entry('a'), restBetweenSets: 601 }] }))).not.toHaveLength(0);
    const base = { setId: 'a:0', exerciseId: 'a', setIndex: 0, reps: 10, status: 'completed', source: 'manual' };
    for (const setType of ['normal', 'warmup', 'drop', 'failure']) expect(await validate(plainToInstance(SetResultDto, { ...base, setType }))).toHaveLength(0);
    expect(await validate(plainToInstance(SetResultDto, { ...base, setType: 'unknown' }))).not.toHaveLength(0);
  });
});
