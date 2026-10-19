'use client';
import { api } from '../lib/api';
import { useAppResource } from './useAppResource';

export type DailyMission = { key: string; title: string; target: number; progress: number; points: number; complete: boolean };
export type ActivityBadge = { id: string; title: string; icon: string; earned: boolean };
export type ActivityState = { timezone: string; questProgress: { workout: number; meals: number; water: number }; level: number; currentExp: number; nextLevelExp: number; dayStreak: number; earnedPoints: number };
export type ActivityResponse = { state: ActivityState; dailyMissions: DailyMission[]; badges: ActivityBadge[] };
const empty: ActivityResponse = { state: { timezone: 'UTC', questProgress: { workout: 0, meals: 0, water: 0 }, level: 1, currentExp: 0, nextLevelExp: 100, dayStreak: 0, earnedPoints: 0 }, dailyMissions: [], badges: [] };
const load = (force?: boolean) => api.getActivity(force);
export function useActivity() {
  const { data, loading, error, refresh } = useAppResource<ActivityResponse>('activity', load);
  const result = data ?? empty;
  return { activity: { ...empty.state, ...result.state }, dailyMissions: result.dailyMissions ?? [], badges: result.badges ?? [], loading, error, refresh };
}
