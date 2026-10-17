'use client';

import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { useApiResource, notifyDataChanged } from './useApiResource';

export type UserSettings = { inactivity: boolean; alarmVolume: boolean; showLeaderboard: boolean; threshold: 30 | 45 | 60; nutritionTargets?: { calories: number; protein: number; carbs: number; fats: number } };
const defaults: UserSettings = { inactivity: true, alarmVolume: true, showLeaderboard: true, threshold: 45 };

export function useSettings() {
  const resource = useApiResource<{ values?: UserSettings }>('settings', () => api.getSettings());
  const [error, setError] = useState('');
  const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
    setError('');
    try { await api.updateSettings(patch); notifyDataChanged('settings'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save settings.'); throw err; }
  }, []);
  return { settings: { ...defaults, ...(resource.data?.values ?? {}) }, loading: resource.loading, error: error || resource.error, updateSettings, retry: resource.refresh };
}
