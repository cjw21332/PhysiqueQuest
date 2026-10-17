'use client';
import { api } from '../lib/api';
import { useApiResource } from './useApiResource';

export type DailyMission = { key: string; title: string; target: number; progress: number; points: number; complete: boolean };
export type ActivityBadge = { id: string; title: string; icon: string; earned: boolean };
export type ActivityState = { timezone: string; questProgress: { workout: number; meals: number; water: number }; level: number; currentExp: number; nextLevelExp: number; dayStreak: number; earnedPoints: number };
export type ActivityResponse = { state: ActivityState; dailyMissions: DailyMission[]; badges: ActivityBadge[] };
const empty: ActivityResponse = { state: { timezone: 'UTC', questProgress: { workout: 0, meals: 0, water: 0 }, level: 1, currentExp: 0, nextLevelExp: 100, dayStreak: 0, earnedPoints: 0 }, dailyMissions: [], badges: [] };
export function useActivity() {
  const resource = useApiResource<ActivityResponse>('activity', () => api.getActivity());
  const result = resource.data;
  return { activity: { ...empty.state, ...(result?.state ?? {}) }, dailyMissions: result?.dailyMissions ?? [], badges: result?.badges ?? [], loading: resource.loading, error: resource.error, refresh: resource.refresh };
}
