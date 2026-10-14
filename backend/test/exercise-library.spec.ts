import { describe, expect, it, vi } from 'vitest';
import { ExerciseLibraryService } from '../src/exercises/exercise-library.service.js';
import { AdminExercisesService } from '../src/exercises/exercises.service.js';
import { ExerciseDto } from '../src/exercises/dto/exercise.dto.js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('published exercise library', () => {
  it('delegates browsing and literal search parameters to the real provider', async () => {
    const findAll = vi.fn().mockResolvedValue({ items: [], source: 'ExerciseDB V1' });
    const service = new ExerciseLibraryService({ findAll } as any);
    const query = { search: 'Press (seated)', equipment: 'Dumbbell', page: 1, limit: 12 };
    await service.findAll(query);
    expect(findAll).toHaveBeenCalledWith(query);
  });

  it('looks up provider IDs and preserves missing-detail errors', async () => {
    const findBySlug = vi.fn().mockRejectedValue(new Error('Exercise not found'));
    const service = new ExerciseLibraryService({ findBySlug } as any);
    await expect(service.findBySlug(' absent ')).rejects.toThrow('Exercise not found');
    expect(findBySlug).toHaveBeenCalledWith('absent');
  });

  it('persists validated catalog fields when an administrator creates an exercise', async () => {
    const dto = plainToInstance(ExerciseDto, { name: 'Seated press', group: 'Shoulders · Dumbbell', targetMuscle: 'Shoulders', equipment: 'Dumbbell', status: 'published', pose: 'missing' });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    const create = vi.fn(async data => data);
    const service = new AdminExercisesService({ create } as any);
    const record = await service.create(dto);
    expect(record).toMatchObject({ name: 'Seated press', targetMuscle: 'Shoulders', equipment: 'Dumbbell', status: 'published', pose: 'missing' });
  });
});
