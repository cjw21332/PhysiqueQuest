import { api, getCoachApiBaseUrl, type ExerciseRecord } from './api';
import { cachedCount, readCatalogMetadata, replaceCatalog } from './exerciseCatalogDb';

async function readVersion(source: string) {
  const response = await fetch(source + '/exercises/sync-status', { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error('Exercise catalog service unavailable.');
  const status = await response.json();
  if (status.status !== 'complete' || typeof status.lastSuccessfulSync !== 'string' ||
      !Number.isSafeInteger(status.count) || status.count < 1) throw new Error('Exercise catalog is still being prepared.');
  return { version: status.lastSuccessfulSync as string, count: status.count as number };
}

async function download() {
  const source = getCoachApiBaseUrl();
  const version = await readVersion(source);
  const metadata = await readCatalogMetadata();
  if (metadata?.source === source && metadata.version === version.version &&
      metadata.count === version.count && await cachedCount() === version.count) return;

  const records = new Map<string, ExerciseRecord>();
  for (let page = 1; records.size < version.count; page++) {
    if (source !== getCoachApiBaseUrl()) throw new Error('Exercise catalog source changed.');
    const result = await api.getExercises({ page, limit: 100 });
    if (result.total !== version.count || result.page !== page || !result.items.length) throw new Error('Incomplete exercise catalog.');
    for (const item of result.items) {
      if (!item._id || !item.name || records.has(item._id)) throw new Error('Invalid exercise catalog page.');
      records.set(item._id, item);
    }
  }
  const latest = await readVersion(source);
  if (source !== getCoachApiBaseUrl() || latest.version !== version.version ||
      latest.count !== version.count || records.size !== version.count) throw new Error('Exercise catalog changed during download.');
  await replaceCatalog([...records.values()], { source, ...version, savedAt: Date.now() });
}

let pending: Promise<void> | undefined;
export function prepareExerciseCatalog() {
  pending ??= download().finally(() => { pending = undefined; });
  return pending;
}
