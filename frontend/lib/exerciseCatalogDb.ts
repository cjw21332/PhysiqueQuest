import type { ExerciseCatalog, ExerciseRecord, ExerciseDiscoveryQuery, ExerciseFilters } from './api';

const DB_NAME = 'physiquequest-exercise-catalog';
const DB_VERSION = 1;
let snapshot: ExerciseRecord[] | undefined;
let revision = 0;
const searchable = new WeakMap<ExerciseRecord, string>();
let previousSearch: { source: ExerciseRecord[]; needle: string; matches: ExerciseRecord[] } | undefined;
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('exercises')) {
        const store = db.createObjectStore('exercises', { keyPath: '_id' });
        store.createIndex('name', 'name');
        store.createIndex('bodyParts', 'bodyParts', { multiEntry: true });
        store.createIndex('equipments', 'equipments', { multiEntry: true });
        store.createIndex('targetMuscles', 'targetMuscles', { multiEntry: true });
        store.createIndex('secondaryMuscles', 'secondaryMuscles', { multiEntry: true });
      }
      if (!db.objectStoreNames.contains('metadata')) db.createObjectStore('metadata');
    };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Exercise storage upgrade is blocked by another tab.'));
  });
}
export async function saveExercises(items: ExerciseRecord[]) {
  if (!items.length) return;
  const db = await openDb();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('exercises', 'readwrite');
    const store = tx.objectStore('exercises');
    for (const item of items) if (item._id && item.name) store.put(item);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); revision++; snapshot = undefined; previousSearch = undefined; } finally { db.close(); }
}
export async function cachedExercise(id: string): Promise<ExerciseRecord | null> {
  const db = await openDb();
  try { return await new Promise((resolve, reject) => { const req = db.transaction('exercises').objectStore('exercises').get(id); req.onsuccess = () => resolve(req.result ?? null); req.onerror = () => reject(req.error); }); }
  finally { db.close(); }
}
async function allCached(): Promise<ExerciseRecord[]> {
  if (snapshot) return snapshot;
  const started = revision;
  const db = await openDb();
  try { const rows = await new Promise<ExerciseRecord[]>((resolve, reject) => { const req = db.transaction('exercises').objectStore('exercises').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); if (started === revision) snapshot = rows; return rows; }
  finally { db.close(); }
}
export async function cachedFilters(): Promise<ExerciseFilters> {
  const rows = await allCached();
  const values = (field: 'bodyParts' | 'equipments' | 'targetMuscles' | 'secondaryMuscles') => [...new Set(rows.flatMap(row => row[field] ?? []))].sort((a, b) => a.localeCompare(b));
  return { bodyParts: values('bodyParts'), equipments: values('equipments'), targetMuscles: values('targetMuscles'), secondaryMuscles: values('secondaryMuscles') };
}
export async function cachedCatalog(query: ExerciseDiscoveryQuery & { page: number; limit: number }): Promise<ExerciseCatalog> {
  let rows = await allCached();
  const needle = query.search?.trim().toLowerCase();
  if (needle) {
    const source = rows;
    const candidates = previousSearch?.source === source && needle.startsWith(previousSearch.needle) ? previousSearch.matches : source;
    rows = candidates.filter(row => {
      let text = searchable.get(row);
      if (text === undefined) { text = [row.name, ...(row.bodyParts ?? []), ...(row.equipments ?? []), ...(row.targetMuscles ?? []), ...(row.secondaryMuscles ?? []), ...(row.instructions ?? [])].join('\n').toLowerCase(); searchable.set(row, text); }
      return text.includes(needle);
    });
    previousSearch = { source, needle, matches: rows };
  }
  rows = rows.filter(item => {
    const row = item as ExerciseRecord & { bodyParts?: string[]; equipments?: string[]; targetMuscles?: string[]; secondaryMuscles?: string[] };
    return (!query.muscle || row.targetMuscle === query.muscle || row.group === query.muscle) && (!query.equipment || row.equipment === query.equipment || row.equipments?.includes(query.equipment)) &&
      (!query.bodyPart || row.bodyParts?.includes(query.bodyPart)) && (!query.target || row.targetMuscles?.includes(query.target)) && (!query.secondary || row.secondaryMuscles?.includes(query.secondary));
  });
  if (query.sort) rows.sort((a, b) => {
    const key = (item: ExerciseRecord) => query.sort === 'body-part' ? item.bodyParts?.[0] ?? '' : query.sort === 'equipment' ? item.equipments?.[0] ?? '' : item.name;
    const order = key(a).localeCompare(key(b), undefined, { sensitivity: 'base' });
    return (query.sort === 'name-desc' ? -order : order) || a._id.localeCompare(b._id);
  });
  const total = rows.length;
  return { items: rows.slice((query.page - 1) * query.limit, query.page * query.limit), total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit), coverageNote: 'Showing exercises saved on this device; the offline catalog may be incomplete.' };
}
export async function cachedCount() {
  const db = await openDb();
  try { return await new Promise<number>((resolve, reject) => { const req = db.transaction('exercises').objectStore('exercises').count(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
  finally { db.close(); }
}
export async function readCatalogMetadata(): Promise<{ version: string; count: number; savedAt: number; source?: string } | null> {
  const db = await openDb();
  try { return await new Promise((resolve, reject) => { const request = db.transaction('metadata').objectStore('metadata').get('catalog'); request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error); }); }
  finally { db.close(); }
}
export async function saveCatalogMetadata(metadata: { version: string; count: number; savedAt: number; source: string }) {
  const db = await openDb();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('metadata', 'readwrite'); tx.objectStore('metadata').put(metadata, 'catalog'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); }
  finally { db.close(); }
}
