import { getApiBaseUrl, type ScannedItem } from './api';
import { session } from './session';

export type PendingScanSave = { scope: string; key: string; payload: { items: ScannedItem[]; meal: string; date: string; time: string; idempotency_key: string } };
const prefix = 'physiquequest-scan-save-v1:';
export function scanSaveScope(): string | null {
  try { const base = getApiBaseUrl(); const user = session.current(base); return user?.id ? `${base}:${user.id}` : null; } catch { return null; }
}
function storageKey(scope: string) { return prefix + encodeURIComponent(scope); }
export function readPendingScanSave(scope: string): PendingScanSave | null {
  const raw = localStorage.getItem(storageKey(scope));
  if (!raw) return null;
  const value = JSON.parse(raw) as PendingScanSave;
  if (value.scope !== scope || !/^[a-f0-9]{32}$/.test(value.key) || value.payload?.idempotency_key !== value.key || !Array.isArray(value.payload?.items) || typeof value.payload?.meal !== 'string') throw new Error('A saved meal recovery record could not be read. Contact support before saving another scan.');
  return value;
}
export function beginPendingScanSave(scope: string, meal: string, items: ScannedItem[], date: string, time: string): PendingScanSave {
  const existing = readPendingScanSave(scope);
  if (existing) {
    if (JSON.stringify({ items: existing.payload.items, meal: existing.payload.meal }) !== JSON.stringify({ items, meal })) throw new Error('A previous meal save has an unknown outcome. Recover it before saving a different meal.');
    return existing;
  }
  const key = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  const record = { scope, key, payload: { items, meal, date, time, idempotency_key: key } };
  localStorage.setItem(storageKey(scope), JSON.stringify(record));
  if (readPendingScanSave(scope)?.key !== key) throw new Error('Could not safely prepare this meal save.');
  return record;
}
export function clearPendingScanSave(scope: string, key: string) {
  if (readPendingScanSave(scope)?.key === key) localStorage.removeItem(storageKey(scope));
}
export async function withScanSaveLock<T>(scope: string, action: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(`physiquequest-scan-save:${scope}`, action);
  throw new Error('This browser cannot safely coordinate meal saves across tabs. Use a supported browser to save or recover this meal.');
}
