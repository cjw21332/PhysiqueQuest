import { NotFoundException } from '@nestjs/common';
import { starterCatalog } from './catalog.js';
import { primaryCategory } from '../coach/movement-curation.js';

export const CURATED_SOURCE = 'PhysiqueQuest';
const searchText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\bpush ups?\b/g, 'pushup').trim();
const equipmentKey = (value: string) => searchText(value).replace(/ only$/, '').replace(/s$/, '');
export const exerciseNameKey = (name: string) => searchText(name).replace(/\s/g, '');
export function curatedExercises() {
  return starterCatalog.map(item => ({ ...item, _id: `pq-${item.slug}`, slug: `pq-${item.slug}`,
    group: primaryCategory(item.targetMuscle, item.group), source: CURATED_SOURCE, gifUrl: '',
    bodyParts: [primaryCategory(item.targetMuscle, item.group)], targetMuscles: [item.targetMuscle], secondaryMuscles: [] as string[],
    equipment: item.equipment === 'Dumbbell' ? 'Dumbbells' : item.equipment,
    description: `${item.targetMuscle} · ${item.equipment} · Manual logging`, checks: [] as string[],
    recommended: /plank|wall sit/i.test(item.name) ? '3 × 30 s' : '3 × 10',
  }));
}
export function findCurated(query: { search?: string; muscle?: string; equipment?: string; page?: number; limit?: number } = {}) {
  const tokens = searchText(query.search?.slice(0, 100) ?? '').split(/\s+/).filter(Boolean);
  const page = Number.isFinite(query.page) ? Math.max(1, Math.floor(query.page!)) : 1;
  const limit = Number.isFinite(query.limit) ? Math.min(100, Math.max(1, Math.floor(query.limit!))) : 12;
  const rows = curatedExercises().filter(item => (!query.muscle || query.muscle === 'All' || item.group.toLowerCase() === query.muscle.toLowerCase())
    && (!query.equipment || ['All', 'Any equipment', 'Full gym'].includes(query.equipment) || equipmentKey(item.equipment) === equipmentKey(query.equipment))
    && tokens.every(token => searchText(item.name).includes(token))).sort((a, b) => a.name.localeCompare(b.name));
  return { items: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit, pages: Math.ceil(rows.length / limit), source: CURATED_SOURCE,
    coverageNote: 'PhysiqueQuest exercises include written instructions and manual logging. Demonstrations and automatic rep counting are not provided for these entries.' };
}
export function curatedDetail(id: string) {
  const item = curatedExercises().find(row => row._id === id);
  if (!item) throw new NotFoundException('Exercise not found');
  return item;
}
