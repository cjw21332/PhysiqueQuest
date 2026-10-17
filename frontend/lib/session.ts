export const AUTH_STORAGE_KEY = 'physiquequest-auth';
export const PROFILE_STORAGE_KEY = 'physiquequest-profile';

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(PROFILE_STORAGE_KEY);
  for (const key of Object.keys(localStorage)) if (key.startsWith('physiquequest-draft:')) localStorage.removeItem(key);
  window.dispatchEvent(new Event('physiquequest:session-cleared'));
}
