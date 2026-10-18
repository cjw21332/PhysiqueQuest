import { expect, it } from 'vitest';
import { seedCatalog } from '../src/exercises/catalog.js';

it('catalog import preserves existing records and does not duplicate a second run', async () => {
  const records = new Map<string, any>([['Dumbbell bench press', { name: 'Dumbbell bench press', status: 'draft', instructions: ['Administrator instructions'] }]]);
  const model = { async updateOne(filter: { name: string }, update: any) {
    if (!records.has(filter.name)) records.set(filter.name, update.$setOnInsert);
  } };
  await seedCatalog(model);
  await seedCatalog(model);
  expect(records.size).toBe(50);
  expect(records.get('Dumbbell bench press')).toEqual({ name: 'Dumbbell bench press', status: 'draft', instructions: ['Administrator instructions'] });
  expect(records.get('Goblet squat')).toMatchObject({ slug: 'goblet-squat', status: 'published', pose: 'missing', equipment: 'Dumbbell', trackingStatus: 'Manual', videoUrl: '' });
});
