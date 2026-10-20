import { getCurrentUser } from './auth';
import { getApiBaseUrl } from './api';

export function calibrationDraftKey() {
  try {
    const user = getCurrentUser();
    return user?.id && user.token ? `physiquequest-calibration:${getApiBaseUrl()}:${user.id}` : null;
  } catch { return null; }
}

export function readCalibrationDraft<T extends Record<string, string | string[] | boolean>>(initial: T): { data: T; step: number; skipped: string[] } | null {
  try {
    const key = calibrationDraftKey();
    const saved = key && JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!saved || saved.version !== 1 || !Number.isInteger(saved.step) || saved.step < 1 || saved.step > 4 || !saved.data) return null;
    const data = { ...initial };
    for (const field of Object.keys(initial) as (keyof T)[]) {
      const value = saved.data[field];
      const expected = initial[field];
      if (Array.isArray(expected)) {
        if (!Array.isArray(value) || value.length > 10 || value.some(item => typeof item !== 'string' || item.length > 100)) return null;
      } else if (typeof value !== typeof expected || (typeof value === 'string' && value.length > 500)) return null;
      data[field] = value;
    }
    for (const [field, choices] of Object.entries({ heightUnit: ['cm', 'ft & in.'], weightUnit: ['kg', 'lbs'], chestUnit: ['cm', 'inch'], waistUnit: ['cm', 'inch'], armsUnit: ['cm', 'inch'] })) {
      if (!choices.includes(String(data[field]))) return null;
    }
    return { data, step: saved.step, skipped: Array.isArray(saved.skipped) ? saved.skipped.filter((item: unknown) => typeof item === 'string' && ['measurements', 'targets', 'camera', 'health'].includes(item)) : [] };
  } catch { return null; }
}

export function clearCalibrationDraft() {
  try { const key = calibrationDraftKey(); if (key) localStorage.removeItem(key); } catch { /* A completed server profile takes priority over any device draft. */ }
}
