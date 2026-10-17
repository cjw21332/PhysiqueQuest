'use client';
import { api, type LeaderboardPeriod, type LeaderboardRecord } from '../lib/api';
import { useApiResource } from './useApiResource';

export function useLeaderboard(period: LeaderboardPeriod) {
  const resource = useApiResource<LeaderboardRecord>(`leaderboard:${period}`, () => api.getLeaderboard(period));
  return { data: resource.data ?? null, loading: resource.loading, error: resource.error, refresh: resource.refresh };
}
