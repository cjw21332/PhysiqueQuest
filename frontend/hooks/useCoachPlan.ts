'use client';
import { api, type CoachPlanRecord } from '../lib/api';
import { useApiResource } from './useApiResource';

export function useCoachPlan(_profile?: Record<string, unknown>) {
  const resource = useApiResource<CoachPlanRecord>('coach-plan', () => api.getCoachPlan());
  return { plan: resource.data ?? null, loading: resource.loading, error: resource.error, refresh: resource.refresh };
}
