import type { ExerciseCatalog } from './api';
const load = () => import('../.generated/repdb').then(module => module.default);
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export async function getRepDbExercises(query: { search?: string; muscle?: string; equipment?: string; page?: number; limit?: number }): Promise<ExerciseCatalog> {
  const words = normalize(query.search ?? '').split(/\s+/).filter(Boolean);
  const records = (await load()).filter(item => words.every(word => normalize(item.name).includes(word)) &&
    (!query.muscle || item.group === query.muscle) && (!query.equipment || item.equipment === query.equipment));
  const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 12)));
  const page = Math.max(1, Math.floor(query.page ?? 1));
  return { items: records.slice((page - 1) * limit, page * limit), page, limit, total: records.length, pages: Math.ceil(records.length / limit), source: 'RepDB', coverageNote: 'Still illustrations and written guides. Manual logging; image availability does not imply automatic counting support.' };
}
export async function getRepDbExercise(id: string) {
  const record = (await load()).find(item => item._id === id);
  if (!record) throw new Error('Exercise not found');
  return record;
}
