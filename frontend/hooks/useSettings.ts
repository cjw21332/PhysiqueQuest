'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export type UserSettings = { inactivity: boolean; alarmVolume: boolean; showLeaderboard: boolean; threshold: 30 | 45 | 60 };
const defaults: UserSettings = { inactivity: true, alarmVolume: true, showLeaderboard: true, threshold: 45 };

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const retry = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await api.getSettings(); setSettings({ ...defaults, ...(result.values ?? {}) }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load settings.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void retry(); }, [retry]);
  const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
    const result = await api.updateSettings(patch); setSettings({ ...defaults, ...(result.values ?? {}) });
  }, []);
  return { settings, loading, error, updateSettings, retry };
}
