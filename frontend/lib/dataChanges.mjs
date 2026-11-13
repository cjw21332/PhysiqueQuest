export const DATA_CHANGE_KEY = 'physiquequest-data-change-v1';
export const DATA_CHANGE_EVENT = 'physiquequest:data-change';
const allowed = new Set(['profile', 'nutrition', 'activity', 'coach', 'notifications', 'progress:weight', 'progress:waist', 'progress:benchPress', 'workouts', 'workout-summary', 'exercise-library', 'settings']);

export function parseDataChange(raw, scope) {
  try {
    const value = JSON.parse(raw);
    if (!scope || value?.scope !== scope || !Array.isArray(value.resources)) return null;
    const resources = [...new Set(value.resources.filter(item => typeof item === 'string' && allowed.has(item)))];
    return resources.length ? resources : null;
  } catch { return null; }
}

export function announceDataChange(scope, resources) {
  if (typeof window === 'undefined' || !scope) return;
  const valid = [...new Set(resources.filter(item => allowed.has(item)))];
  if (!valid.length) return;
  window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT, { detail: { resources: valid } }));
  try { window.localStorage.setItem(DATA_CHANGE_KEY, JSON.stringify({ scope, resources: valid, nonce: `${Date.now()}-${Math.random()}` })); } catch { /* Other tabs refresh on focus when storage is unavailable. */ }
}
