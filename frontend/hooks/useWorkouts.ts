'use client';
import { useCallback } from 'react';
import { api } from '../lib/api';
import type { WorkoutSessionRecord } from '../lib/api';
import type { WorkoutExercise } from '../../shared/workouts';
import { notifyDataChanged } from './useApiResource';

export function useWorkouts() {
  const startWorkout = useCallback((exerciseIds: string[], startedAt = new Date().toISOString()) => api.createWorkout({ exerciseIds, startedAt }), []);
  const setPaused = useCallback((id: string, paused: boolean) => api.pauseWorkout(id, { paused, occurredAt: new Date().toISOString() }), []);
  const completeWorkout = useCallback((id: string, durationSeconds: number, exerciseResults: NonNullable<WorkoutSessionRecord['exerciseResults']> = [], endedAt = new Date().toISOString()) => api.completeWorkout(id, { endedAt, durationSeconds, exerciseResults }), []);
  const getRecent = useCallback(() => api.getWorkouts(), []);
  const createSession = useCallback(async (exercises: WorkoutExercise[], requestKey: string, startedAt: string, context?: { programVersion?: string; dayIndex?: number; scheduledDate?: string }) => {
    const record = await api.createWorkout({ exerciseIds: exercises.map(exercise => exercise.exerciseId), exercises, startedAt, requestKey, origin: 'planned', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', ...context });
    notifyDataChanged('workouts', 'workout-history'); return record as WorkoutSessionRecord;
  }, []);
  return { startWorkout, setPaused, completeWorkout, getRecent, createSession };
}
