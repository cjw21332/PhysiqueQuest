export const AUTH_STORAGE_KEY = 'physiquequest-auth';
export const PROFILE_STORAGE_KEY = 'physiquequest-profile';

export function clearAuthSession(broadcast = true): void {
  session.clear();
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    if (broadcast) localStorage.setItem('physiquequest-logout', String(Date.now()));
  } catch { /* Session clearing must work when storage is unavailable. */ }
  window.dispatchEvent(new Event('physiquequest:session-ended'));
}
import { createSession } from './rotatingSession.mjs';
export function appVersionHeaders(): Record<string, string> {
  let version = process.env.NEXT_PUBLIC_APP_VERSION;
  try { if (typeof window !== 'undefined') version = localStorage.getItem('physiquequest-app-version') || version; } catch { /* Native metadata is optional. */ }
  return version && /^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(version) ? { 'X-App-Version': version } : {};
}
export const session = createSession({ storage: () => typeof window === 'undefined' ? undefined : window.localStorage, headers: appVersionHeaders });
