'use client';
import { useCallback } from 'react';
import { api } from '../lib/api';

export function useWorkouts() {
  const startWorkout = useCallback((exerciseIds: string[]) => api.createWorkout({ exerciseIds, startedAt: new Date().toISOString() }), []);
  const setPaused = useCallback((id: string, paused: boolean) => api.pauseWorkout(id, { paused, occurredAt: new Date().toISOString() }), []);
  const completeWorkout = useCallback((id: string, durationSeconds: number) => api.completeWorkout(id, { endedAt: new Date().toISOString(), durationSeconds, exerciseResults: [] }), []);
  const getRecent = useCallback(() => api.getWorkouts(), []);
  return { startWorkout, setPaused, completeWorkout, getRecent };
}
