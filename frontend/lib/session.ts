import { nativeDeviceRefresh, nativeOfflineAccount } from './nativeOfflineAccount';
import { DEVICE_CACHE_STORAGE_KEY } from './deviceCache.mjs';
export const AUTH_STORAGE_KEY = 'physiquequest-auth';
export const PROFILE_STORAGE_KEY = 'physiquequest-profile';
// Set by an explicit logout. Automatic session restore stays off until the user signs in again, so a
// logout that could not reach the server (or a leftover refresh cookie) can never sign them back in.
export const SIGNED_OUT_KEY = 'physiquequest-signed-out';
export function markSignedOut(signedOut: boolean): void {
  try { if (signedOut) localStorage.setItem(SIGNED_OUT_KEY, '1'); else localStorage.removeItem(SIGNED_OUT_KEY); } catch { /* Storage may be unavailable. */ }
}
export function signedOutByUser(): boolean {
  try { return typeof window !== 'undefined' && localStorage.getItem(SIGNED_OUT_KEY) === '1'; } catch { return false; }
}

export function clearAuthSession(broadcast = true): void {
  session.clear();
  void nativeOfflineAccount('forget-offline-account');
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    localStorage.removeItem(DEVICE_CACHE_STORAGE_KEY);
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
export const session = createSession({ storage: () => typeof window === 'undefined' ? undefined : window.localStorage, headers: appVersionHeaders, nativeRefresh: nativeDeviceRefresh });
