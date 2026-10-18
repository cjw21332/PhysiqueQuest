import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { commonMovementScore } from '../coach/movement-curation.js';
import { curatedDetail, curatedExercises, exerciseNameKey, findCurated } from './curated-catalog.js';

export const SOURCE = 'ExerciseDB V1';
const PARTS: Record<string, string[]> = { Chest: ['chest'], Back: ['back'], Legs: ['upper legs', 'lower legs'], Core: ['waist'], Shoulders: ['shoulders'], Arms: ['upper arms', 'lower arms'], Cardio: ['cardio'] };
const EQUIPMENT: Record<string, string[]> = { Dumbbells: ['dumbbell'], Barbell: ['barbell', 'olympic barbell', 'EZ bar', 'trap bar'], Bodyweight: ['bodyweight'], 'Resistance bands': ['resistance band'], Cable: ['cable'], Machine: ['leverage machine', 'smith machine', 'sled machine', 'elliptical machine', 'stepmill machine', 'stationary bike'], Kettlebell: ['kettlebell'] };
type RawExercise = { exerciseId: string; name: string; gifUrl: string; bodyParts: string[]; equipments: string[]; targetMuscles: string[]; secondaryMuscles: string[]; instructions: string[] };
type Envelope = { success: boolean; data: RawExercise[] | RawExercise; meta?: { total?: number; hasNextPage?: boolean; nextCursor?: string } };
export type CatalogQuery = { source?: string; search?: string; muscle?: string; equipment?: string; page?: number; limit?: number };
const words = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
function closeWord(query: string, candidate: string): boolean {
  if (candidate.includes(query)) return true;
  if (query.length < 4 || Math.abs(query.length - candidate.length) > 1) return false;
  let previous = Array.from({ length: candidate.length + 1 }, (_, index) => index);
  for (let i = 1; i <= query.length; i++) {
    const current = [i];
    for (let j = 1; j <= candidate.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(query[i - 1] !== candidate[j - 1]));
    previous = current;
  }
  return previous[candidate.length] <= 1;
}
const commonScore = commonMovementScore;
export function normalizeExercise(row: RawExercise) {
  if (!row || typeof row.exerciseId !== 'string' || typeof row.name !== 'string' || typeof row.gifUrl !== 'string' || ![row.bodyParts, row.equipments, row.targetMuscles, row.secondaryMuscles, row.instructions].every(value => Array.isArray(value) && value.every(item => typeof item === 'string'))) {
    throw new HttpException({ message: 'ExerciseDB returned invalid exercise metadata', source: SOURCE }, 502);
  }
  const targetMuscle = Object.entries(PARTS).find(([, parts]) => row.bodyParts.some(part => parts.includes(part)))?.[0] ?? row.bodyParts[0] ?? 'General';
  const equipment = Object.entries(EQUIPMENT).find(([, names]) => row.equipments.some(name => names.includes(name)))?.[0] ?? row.equipments.join(' + ');
  const instructions = row.instructions.map(step => step.replace(/^Step\s*:\s*\d+\s*/i, '').trim()).filter(Boolean);
  return { _id: row.exerciseId, slug: row.exerciseId, name: row.name, group: targetMuscle, targetMuscle, equipment, bodyParts: row.bodyParts, targetMuscles: row.targetMuscles, secondaryMuscles: row.secondaryMuscles, gifUrl: row.gifUrl, instructions, description: `${row.targetMuscles.join(', ')} · ${row.equipments.join(', ')}`, checks: instructions.filter(step => /keep|avoid|maintain/i.test(step)), recommended: /plank|hold|wall sit/i.test(row.name) ? '3 × 45 s' : '3 × 12', trackingStatus: 'Manual', pose: 'missing', source: SOURCE };
}

@Injectable()
export class ExerciseDbService {
  private nextRequestAt = 0;
  private readonly inFlight = new Map<string, Promise<Envelope>>();
  private request(path: string, deadline = Date.now() + 8000): Promise<Envelope> {
    const existing = this.inFlight.get(path);
    if (existing) return existing;
    const pending = this.requestActual(path, deadline).finally(() => this.inFlight.delete(path));
    this.inFlight.set(path, pending);
    return pending;
  }
  private async requestActual(path: string, deadline: number): Promise<Envelope> {
    try {
      // Pace all requests in this process, including concurrent browser requests.
      // The free API may throttle bursts; do not retry or synchronize its catalog.
      const slot = Math.max(Date.now(), this.nextRequestAt);
      if (slot >= deadline || slot - Date.now() > 10000) throw new HttpException({ message: 'Exercise catalog is busy. Please retry shortly.', source: SOURCE }, 503);
      this.nextRequestAt = slot + 1200;
      const wait = slot - Date.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new DOMException('ExerciseDB deadline exceeded', 'TimeoutError');
      const response = await fetch(`https://oss.exercisedb.dev/api/v1${path}`, { signal: AbortSignal.timeout(Math.min(8000, remaining)) });
      if (response.status === 404) throw new NotFoundException('Exercise not found');
      if (!response.ok) throw new HttpException({ message: response.status === 429 ? 'ExerciseDB is rate limited. Please retry later.' : 'ExerciseDB is unavailable', source: SOURCE, ...(response.headers.get('retry-after') ? { retryAfter: response.headers.get('retry-after') } : {}) }, response.status === 429 ? 429 : response.status === 503 ? 503 : 502);
      const body = await response.json() as Envelope;
      if (!body.success || !body.data) throw new Error('Invalid ExerciseDB response');
      return body;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException({ message: error instanceof Error && /timeout|abort/i.test(error.name) ? 'ExerciseDB request timed out' : 'ExerciseDB could not be reached', source: SOURCE }, error instanceof Error && /timeout|abort/i.test(error.name) ? 504 : 502);
    }
  }

  async findAll(query: CatalogQuery = {}, pageBudget = 4, deadline = Date.now() + 20000) {
    if (query.source === 'physiquequest') return findCurated(query);
    const page = Number.isFinite(query.page) ? Math.min(9, Math.max(1, Math.floor(query.page!))) : 1;
    const limit = Number.isFinite(query.limit) ? Math.min(100, Math.max(1, Math.floor(query.limit!))) : 12;
    const search = query.search?.trim().slice(0, 100) ?? '';
    const params = new URLSearchParams({ limit: '25' });
    const parts = PARTS[query.muscle ?? ''];
    if (parts) params.set('bodyParts', parts.join(','));
    const equipment = this.equipmentAliases(query.equipment ?? '');
    if (equipment.length) params.set('equipments', equipment.join(','));
    let rows: RawExercise[] = [];
    let more = false;
    if (search) {
      const tokens = words(search);
      params.set('name', search);
      const pool: RawExercise[] = [];
      for (let index = 0; index < pageBudget; index++) {
        const result = await this.request(`/exercises?${params}`, deadline);
        pool.push(...(Array.isArray(result.data) ? result.data : []));
        more = Boolean(result.meta?.hasNextPage && result.meta.nextCursor);
        if (!more) break;
        params.set('after', result.meta!.nextCursor!);
      }
      rows = pool.filter(row => tokens.every(token => words(row.name).some(word => word.includes(token))));
      if (!rows.length) {
        // Fuzzy search returns brief records. Hydrate only a few sensible typo matches.
        const result = await this.request(`/exercises/search?${new URLSearchParams({ search, threshold: '0.15' })}`, deadline);
        const brief = Array.isArray(result.data) ? result.data : [];
        const candidates = brief.filter(row => tokens.every(token => words(row.name).some(word => closeWord(token, word)))).slice(0, 3);
        for (const candidate of candidates) {
          const full = candidate.instructions ? candidate : (await this.request(`/exercises/${encodeURIComponent(candidate.exerciseId)}`, deadline)).data as RawExercise;
          if ((!parts || full.bodyParts.some(part => parts.includes(part))) && (!equipment.length || full.equipments.some(item => equipment.includes(item)))) rows.push(full);
        }
        more = more || brief.length > candidates.length;
      }
      rows.sort((a, b) => Number(b.name.toLowerCase() === search.toLowerCase()) - Number(a.name.toLowerCase() === search.toLowerCase()) || commonScore(b.name) - commonScore(a.name) || a.name.localeCompare(b.name));
    } else {
      for (let index = 0; index < pageBudget; index++) {
        const result = await this.request(`/exercises?${params}`, deadline);
        rows.push(...(Array.isArray(result.data) ? result.data : []));
        more = Boolean(result.meta?.hasNextPage && result.meta.nextCursor);
        if (!more) break;
        params.set('after', result.meta!.nextCursor!);
      }
      rows.sort((a, b) => commonScore(b.name) - commonScore(a.name) || a.name.localeCompare(b.name));
    }
    const unique = [...new Map(rows.map(row => [row.exerciseId, row])).values()];
    return { items: unique.slice((page - 1) * limit, page * limit).map(normalizeExercise), total: unique.length, page, limit, pages: Math.ceil(unique.length / limit), source: SOURCE, coverageNote: more ? 'Showing a bounded selection from ExerciseDB; totals describe this selection, not the complete catalog.' : undefined };
  }

  async findBySlug(id: string) {
    if (id.startsWith('pq-')) return curatedDetail(id);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id.trim())) throw new NotFoundException('Exercise not found');
    return normalizeExercise((await this.request(`/exercises/${encodeURIComponent(id.trim())}`)).data as RawExercise);
  }

  async getForPlan(equipment: string[], goal?: string) {
    const groups = Object.keys(PARTS).filter(group => group !== 'Cardio' || goal === 'Endurance');
    const records = [] as ReturnType<typeof normalizeExercise>[];
    const deadline = Date.now() + 30000;
    const allowed = equipment.includes('Full gym') || !equipment.length ? undefined : [...new Set([...equipment.flatMap(value => this.equipmentAliases(value)), 'bodyweight'])].join(',');
    // At most fourteen live category pages, with cardio only for endurance.
    for (const muscle of groups) records.push(...(await this.findAll({ muscle, equipment: allowed, limit: 100 }, 2, deadline)).items);
    const names = new Set(records.map(row => exerciseNameKey(row.name)));
    const local = curatedExercises().filter(row => !names.has(exerciseNameKey(row.name))
      && (!allowed || this.equipmentAliases(row.equipment).some(alias => allowed.split(',').includes(alias))));
    return [...new Map([...records, ...local].map(row => [row._id, row])).values()];
  }

  private equipmentAliases(value: string): string[] {
    if (value.includes(',')) return value.split(',').flatMap(item => this.equipmentAliases(item.trim()));
    if (value === 'Bodyweight only') return ['bodyweight'];
    const key = Object.keys(EQUIPMENT).find(label => label.toLowerCase() === value.toLowerCase() || label.toLowerCase().replace(/s$/, '') === value.toLowerCase().replace(/s$/, ''));
    return key ? EQUIPMENT[key] : value && !['All', 'Any equipment', 'Full gym'].includes(value) ? [value.toLowerCase()] : [];
  }
}
