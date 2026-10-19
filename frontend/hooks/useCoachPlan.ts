'use client';
import { api, type CoachPlanRecord } from '../lib/api';
import { useAppResource } from './useAppResource';

const load = (force?: boolean) => api.getCoachPlan(force);
export function useCoachPlan(_profile?: Record<string, unknown>) {
  const { data, loading, error, refresh, refreshing, savedAt } = useAppResource<CoachPlanRecord>('coach', load);
  return { plan: data ?? null, loading, error, refresh, refreshing, savedAt };
}
