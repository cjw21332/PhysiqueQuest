const STORAGE_KEY = 'physiquequest-device-cache-v1';
const RESOURCES = ['profile', 'nutrition', 'activity', 'coach', 'notifications', 'progress:weight', 'progress:waist', 'progress:benchPress', 'workouts', 'exercise-library'];
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 512_000;
const day = time => new Date(time).toLocaleDateString('en-CA');

// One bounded snapshot for the last account. Server responses remain authoritative.
export function createDeviceCache({ context, storage, now = Date.now, validate = () => true }) {
  let active = null;
  let entries = {};
  const listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  const same = value => {
    const current = context();
    return value && current?.scope === value.scope && current.session === value.session;
  };
  const usable = (key, entry) => entry && typeof entry.savedAt === 'number'
    && now() >= entry.savedAt && now() - entry.savedAt < MAX_AGE
    && (key !== 'activity' || day(entry.savedAt) === day(now()))
    && entry.data !== null && typeof entry.data === 'object' && validate(key, entry.data);
  const activate = () => {
    const current = context();
    if (current?.scope === active?.scope && current?.session === active?.session) return current;
    active = current;
    entries = {};
    if (current) {
      try {
        const raw = storage()?.getItem(STORAGE_KEY) ?? 'null';
        const snapshot = raw.length * 2 <= MAX_BYTES * RESOURCES.length + 4096 ? JSON.parse(raw) : null;
        if (snapshot?.version === 1 && snapshot.scope === current.scope) {
          for (const key of RESOURCES) {
            const entry = snapshot.entries?.[key];
            if (usable(key, entry)) entries[key] = { data: entry.data, savedAt: entry.savedAt, revision: 0 };
          }
        }
      } catch { /* Storage is optional, including damaged or unavailable storage. */ }
    }
    return current;
  };
  const persist = () => {
    try {
      const saved = {};
      for (const key of RESOURCES) {
        const entry = entries[key];
        if (usable(key, entry) && JSON.stringify(entry.data).length * 2 <= MAX_BYTES) {
          saved[key] = { data: entry.data, savedAt: entry.savedAt };
        }
      }
      if (Object.keys(saved).length) storage()?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, scope: active.scope, entries: saved }));
      else storage()?.removeItem(STORAGE_KEY);
    } catch { /* Quota or storage restrictions must not turn a successful save into an error. */ }
  };
  const get = key => {
    activate();
    let entry = entries[key] ?? {};
    if (entry.data !== undefined && !usable(key, entry)) {
      entry = entries[key] = { revision: (entry.revision ?? 0) + 1 };
      if (active) persist();
    }
    return { data: usable(key, entry) ? entry.data : undefined, savedAt: entry.savedAt, refreshing: Boolean(entry.pending), error: entry.error ?? '' };
  };
  const publish = (key, data) => {
    if (!RESOURCES.includes(key)) throw new Error('Resource is not allowed in the device cache');
    if (!activate()) return;
    entries[key] = { ...entries[key], data, savedAt: now(), confirmedAt: now(), revision: (entries[key]?.revision ?? 0) + 1, error: '' };
    persist();
    notify();
  };
  const invalidate = key => {
    activate();
    entries[key] = { revision: (entries[key]?.revision ?? 0) + 1 };
    persist();
    notify();
  };
  const fetch = (key, load, force = false) => {
    if (!RESOURCES.includes(key)) return Promise.reject(new Error('Unknown cached resource'));
    const owner = activate();
    if (!owner) return Promise.reject(new Error('Sign in to load your saved data.'));
    const entry = entries[key] ?? (entries[key] = { revision: 0 });
    if (entry.pending) return entry.pending;
    if (!force && usable(key, entry) && entry.confirmedAt && now() - entry.confirmedAt < 60_000) return Promise.resolve(entry.data);
    const revision = entry.revision;
    const request = Promise.resolve().then(load).then(data => {
      if (!validate(key, data)) throw new Error('The server returned incomplete data. Try refreshing.');
      if (same(owner) && entries[key]?.revision === revision) {
        publish(key, data);
        entries[key].confirmedAt = now();
      }
      return data;
    }).catch(error => {
      if (same(owner) && entries[key]?.revision === revision) {
        entries[key].error = error instanceof Error ? error.message : 'Could not update saved data.';
      }
      throw error;
    }).finally(() => {
      if (same(owner) && entries[key]?.pending === request) {
        delete entries[key].pending;
        notify();
      }
    });
    entry.pending = request;
    entry.error = '';
    notify();
    return request;
  };
  return { get, publish, invalidate, fetch, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
}
