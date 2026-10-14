import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WgerService, mapWgerExercise } from '../src/exercises/wger.service.js';
import { ExerciseLibraryService } from '../src/exercises/exercise-library.service.js';

const exercise = (id = 1, name = 'Bench press') => ({
  id, category: { name: 'Chest' }, equipment: [{ name: 'Dumbbell' }, { name: 'Bench' }],
  translations: [{ name: 'German name', language: 1, description: '' }, { name, language: 2, description: '<p>Brace &amp; press.</p><script>bad()</script><p>Lower slowly.</p>', license_author: 'Writer' }],
  license: { short_name: 'CC BY-SA', url: 'https://creativecommons.org/licenses/by-sa/4.0/' }, license_author: 'Author',
  images: [{ image: 'https://wger.de/image.jpg', is_main: true, license_author: 'Photographer' }], videos: [],
});
afterEach(() => vi.unstubAllGlobals());

describe('wger exercise library', () => {
  it('selects English, preserves attribution, strips HTML, and does not claim AI tracking', () => {
    const item = mapWgerExercise(exercise())!;
    expect(item.name).toBe('Bench press');
    expect(item.instructions).toEqual(['Brace & press.', 'Lower slowly.']);
    expect(item.trackingStatus).toBe('Manual');
    expect(item.attribution.author).toBe('Writer');
    expect(item.imageAttribution?.author).toBe('Photographer');
    expect(mapWgerExercise({ ...exercise(), translations: [] })).toBeNull();
  });

  it('authenticates server-side, follows pagination on the fixed host, and caches concurrent reads', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [exercise()], next: 'https://other-host.test/' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [exercise(2, 'Row')], next: null }) });
    vi.stubGlobal('fetch', fetcher);
    const service = new WgerService(new ConfigService({ WGER_API_KEY: 'test-secret' }));
    const [first, second] = await Promise.all([service.catalog(), service.catalog()]);
    expect(first).toBe(second);
    expect(first).toHaveLength(2);
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Token test-secret');
    expect(fetcher.mock.calls[2][0]).toBe('https://wger.de/api/v2/exerciseinfo/?limit=200&offset=1');
    await service.catalog();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(first)).not.toContain('test-secret');
  });

  it('returns a safe service error and allows a retry after failure', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [exercise()], next: null }) });
    vi.stubGlobal('fetch', fetcher);
    const service = new WgerService(new ConfigService());
    await expect(service.catalog()).rejects.toThrow('wger exercise library is unavailable');
    expect(await service.catalog()).toHaveLength(1);
  });

  it('resolves independent numeric licenses for descriptions and media', () => {
    const input = exercise();
    const item = mapWgerExercise({ ...input, translations: [{ ...input.translations[1], license: 3 }], images: [{ ...input.images[0], license: 4 }] }, [
      { id: 3, short_name: 'CC BY', url: 'https://creativecommons.org/licenses/by/4.0/' },
      { id: 4, short_name: 'Public domain', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
    ])!;
    expect(item.attribution.license).toBe('CC BY');
    expect(item.imageAttribution?.license).toBe('Public domain');
  });

  it('filters before pagination and resolves stable wger detail IDs', async () => {
    const items = [mapWgerExercise(exercise())!, mapWgerExercise(exercise(2, 'Incline press'))!];
    const service = new ExerciseLibraryService({} as any, { catalog: async () => items } as WgerService);
    const result = await service.findAll({ search: ' PRESS ', muscle: 'Chest', equipment: 'Dumbbells', page: 2, limit: 1 });
    expect(result.total).toBe(2);
    expect(result.items[0].slug).toBe('wger-2');
    expect(await service.findBySlug('wger-1')).toBe(items[0]);
    await expect(service.findBySlug('wger-99')).rejects.toThrow('Exercise not found');
    expect((await service.findAll({ page: NaN, limit: NaN })).page).toBe(1);
  });
});
