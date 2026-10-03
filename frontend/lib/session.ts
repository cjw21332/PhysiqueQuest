export const AUTH_STORAGE_KEY = 'physiquequest-auth';
export const PROFILE_STORAGE_KEY = 'physiquequest-profile';

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
