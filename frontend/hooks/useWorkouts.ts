'use client';
import { useCallback } from 'react';
import { api } from '../lib/api';
import type { WorkoutSessionRecord, WorkoutExerciseSnapshot } from '../lib/api';

export function useWorkouts() {
  const startWorkout = useCallback((exerciseIds: string[], exercises?: WorkoutExerciseSnapshot[], requestKey?: string, startedAt = new Date().toISOString()) => api.createWorkout({ exerciseIds, exercises, requestKey, startedAt }), []);
  const setPaused = useCallback((id: string, paused: boolean) => api.pauseWorkout(id, { paused, occurredAt: new Date().toISOString() }), []);
  const completeWorkout = useCallback((id: string, durationSeconds: number, exerciseResults: NonNullable<WorkoutSessionRecord['exerciseResults']> = []) => api.completeWorkout(id, { endedAt: new Date().toISOString(), durationSeconds, exerciseResults }), []);
  const getRecent = useCallback(() => api.getWorkouts(), []);
  return { startWorkout, setPaused, completeWorkout, getRecent };
}
