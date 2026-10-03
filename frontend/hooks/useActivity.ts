'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
export type QuestProgress = { workout: number; meals: number; water: number; personalRecord: number };
export type ActivityState = { questProgress: QuestProgress; level: number; currentExp: number; nextLevelExp: number; dayStreak: number; [key: string]: unknown };
const empty: ActivityState = { questProgress: { workout: 0, meals: 0, water: 0, personalRecord: 0 }, level: 1, currentExp: 0, nextLevelExp: 100, dayStreak: 0 };
export function useActivity() {
  const [activity, setActivity] = useState<ActivityState>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => { setLoading(true); setError(''); try { const result = await api.getActivity(); setActivity({ ...empty, ...(result.state ?? {}), questProgress: { ...empty.questProgress, ...(result.state?.questProgress ?? {}) } }); } catch (err) { setError(err instanceof Error ? err.message : 'Could not load activity.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const update = useCallback(async (patch: Partial<ActivityState>) => { const result = await api.updateActivity(patch); setActivity({ ...empty, ...(result.state ?? {}), questProgress: { ...empty.questProgress, ...(result.state?.questProgress ?? {}) } }); }, []);
  return { activity, loading, error, refresh, update };
}
