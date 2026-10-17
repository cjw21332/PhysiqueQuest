'use client';
import { api } from '../lib/api';
import { workoutCalendarDate } from '../../shared/workouts';
import { useApiResource } from './useApiResource';

export function useWorkoutDay(date?: string) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const resource = useApiResource(date ? `workout-history:${date}:${timezone}` : 'workout-history',
    () => date ? api.getDayWorkouts(date, timezone) : api.getWorkouts());
  // Also filter locally while a selected-day request replaces an old snapshot.
  return { ...resource, data: resource.data?.filter(workout => !date || workoutCalendarDate(workout, timezone) === date) };
}
