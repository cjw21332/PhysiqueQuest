'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export type DailyMission = { key: string; title: string; target: number; progress: number; points: number; complete: boolean };
export type ActivityBadge = { id: string; title: string; icon: string; earned: boolean };
export type ActivityState = { timezone: string; questProgress: { workout: number; meals: number; water: number }; level: number; currentExp: number; nextLevelExp: number; dayStreak: number; earnedPoints: number };
export type ActivityResponse = { state: ActivityState; dailyMissions: DailyMission[]; badges: ActivityBadge[] };
const empty: ActivityResponse = { state: { timezone: 'UTC', questProgress: { workout: 0, meals: 0, water: 0 }, level: 1, currentExp: 0, nextLevelExp: 100, dayStreak: 0, earnedPoints: 0 }, dailyMissions: [], badges: [] };
export function useActivity() {
  const [activity, setActivity] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const result = await api.updateActivity({ timezone }) as ActivityResponse;
      setActivity({ ...empty, ...result, state: { ...empty.state, ...(result.state ?? {}) }, dailyMissions: result.dailyMissions ?? [], badges: result.badges ?? [] });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load quests.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { activity: activity.state, dailyMissions: activity.dailyMissions, badges: activity.badges, loading, error, refresh };
}
