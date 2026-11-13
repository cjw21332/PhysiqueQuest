'use client';
import { api, type WorkoutSummary } from '../lib/api';
import { useAppResource } from './useAppResource';
const load = (force?: boolean) => api.getWorkoutSummary(force);
export function useWorkoutSummary() {
  const { data, loading, error, refresh } = useAppResource<WorkoutSummary>('workout-summary', load);
  return { summary: data ?? null, loading, error, refresh };
}
