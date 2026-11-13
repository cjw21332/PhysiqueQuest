'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { DATA_CHANGE_EVENT } from '../lib/dataChanges.mjs';

export type UserSettings = { inactivity: boolean; alarmVolume: boolean; showLeaderboard: boolean; threshold: 30 | 45 | 60 };
const defaults: UserSettings = { inactivity: true, alarmVolume: true, showLeaderboard: true, threshold: 30 };

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
  useEffect(() => {
    void retry();
    const changed = (event: Event) => { if ((event as CustomEvent<{ resources?: string[] }>).detail?.resources?.includes('settings')) void retry(); };
    window.addEventListener(DATA_CHANGE_EVENT, changed);
    let active = true;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void api.getSettings().then(result => { if (active) setSettings({ ...defaults, ...(result.values ?? {}) }); }).catch(() => {}); }, 60_000);
    return () => { active = false; window.removeEventListener(DATA_CHANGE_EVENT, changed); window.clearInterval(timer); };
  }, [retry]);
  const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
    setError('');
    try { const result = await api.updateSettings(patch); setSettings({ ...defaults, ...(result.values ?? {}) }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save settings.'); throw err; }
  }, []);
  return { settings, loading, error, updateSettings, retry };
}
