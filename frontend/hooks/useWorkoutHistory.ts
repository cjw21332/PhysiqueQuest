'use client';
import { api, type WorkoutSessionRecord } from '../lib/api';
import { useAppResource } from './useAppResource';

const load = (force?: boolean) => api.getWorkouts(20, force);
export function useWorkoutHistory() {
  const { data, loading, error } = useAppResource<WorkoutSessionRecord[]>('workouts', load);
  return { workouts: data ?? [], workoutLoading: loading, workoutError: error };
}
