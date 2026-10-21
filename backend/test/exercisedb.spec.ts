import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExerciseDbService } from '../src/exercises/exercisedb.service.js';
import { StandaloneCoachController } from '../src/coach/standalone-coach.module.js';

const row = (id = 'real-id', name = 'dumbbell bench press') => ({ exerciseId: id, name, gifUrl: `https://static.exercisedb.dev/media/${id}.gif`, bodyParts: ['chest'], equipments: ['dumbbell'], targetMuscles: ['pectorals'], secondaryMuscles: ['triceps'], instructions: ['Step:1 Keep your feet on the floor.'] });
const response = (data: unknown, meta?: unknown) => new Response(JSON.stringify({ success: true, data, meta }), { status: 200 });
afterEach(() => vi.unstubAllGlobals());

describe('ExerciseDB live adapter contract', () => {
  it('reuses a hot public detail for 30 seconds and refetches after expiry', async () => {
    let clock = 10_000; const now = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const fetcher = vi.fn().mockImplementation(async () => response(row())); vi.stubGlobal('fetch', fetcher);
    try {
      const service = new ExerciseDbService();
      await service.findBySlug('real-id'); await service.findBySlug('real-id');
      expect(fetcher).toHaveBeenCalledTimes(1);
      clock += 31_000; await service.findBySlug('real-id'); expect(fetcher).toHaveBeenCalledTimes(2);
    } finally { now.mockRestore(); }
  });
  it('normalizes actual metadata and GIFs without fabricated tracking or videos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(row())));
    const actual = await new ExerciseDbService().findBySlug('real-id');
    expect(actual).toMatchObject({ _id: 'real-id', slug: 'real-id', targetMuscle: 'Chest', equipment: 'Dumbbells', instructions: ['Keep your feet on the floor.'], trackingStatus: 'Manual', pose: 'missing', source: 'ExerciseDB V1' });
    expect(actual.gifUrl).toContain('.gif');
    expect(actual).not.toHaveProperty('videoUrl');
  });

  it('traverses at most four cursor pages and exposes partial coverage honestly', async () => {
    const fetcher = vi.fn().mockImplementation(async () => response([row()], { hasNextPage: true, nextCursor: `next-${fetcher.mock.calls.length}` }));
    vi.stubGlobal('fetch', fetcher);
    const result = await new ExerciseDbService().findAll({ muscle: 'Chest', equipment: 'Dumbbells' });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls[0][0]).toContain('bodyParts=chest');
    expect(fetcher.mock.calls[0][0]).toContain('equipments=dumbbell');
    expect(result.total).toBe(1);
    expect(result.coverageNote).toContain('bounded');
  });

  it('keeps every query token and rejects unrelated upstream fuzzy hits', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response([row('one'), row('two', 'dumbbell curl')]));
    vi.stubGlobal('fetch', fetcher);
    const result = await new ExerciseDbService().findAll({ search: 'bench press' });
    expect(result.items.map(item => item.name)).toEqual(['dumbbell bench press']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('accepts a single-letter typo only when all query tokens stay close', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([{ exerciseId: 'one', name: 'dumbbell bench press' }, { exerciseId: 'two', name: 'dumbbell curl' }])).mockResolvedValueOnce(response(row('one'))));
    expect((await new ExerciseDbService().findAll({ search: 'bench presz' })).items).toHaveLength(1);
  });

  it.each([429, 503, 500])('propagates upstream failure %i without seed fallback', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })));
    await expect(new ExerciseDbService().findAll()).rejects.toMatchObject({ status: status === 500 ? 502 : status });
  });

  it('maps deadline and connection errors to useful HTTP codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('deadline', 'TimeoutError')));
    await expect(new ExerciseDbService().findAll()).rejects.toMatchObject({ status: 504 });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(new ExerciseDbService().findAll()).rejects.toMatchObject({ status: 502 });
  });

  it('validates standalone program context before any remote lookup', async () => {
    const getForPlan = vi.fn();
    const controller = new StandaloneCoachController({ getForPlan } as any);
    await expect(controller.plan({ profile: { goal: 'nonsense' } })).rejects.toMatchObject({ status: 400 });
    expect(getForPlan).not.toHaveBeenCalled();
    expect(controller.status()).toMatchObject({ status: 'ready', persistence: 'stateless', source: 'ExerciseDB V1' });
  });

  it('deduplicates concurrent requests and retains the public result briefly', async () => {
    const fetcher = vi.fn().mockImplementation(async () => response(row()));
    vi.stubGlobal('fetch', fetcher);
    const service = new ExerciseDbService();
    await Promise.all([service.findBySlug('real-id'), service.findBySlug('real-id')]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await service.findBySlug('real-id');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
