'use client';
import { api } from '../lib/api';
import { useApiResource } from './useApiResource';
export function useWorkoutSummary() { return useApiResource('workout-summary', () => api.getWorkoutSummary()); }
