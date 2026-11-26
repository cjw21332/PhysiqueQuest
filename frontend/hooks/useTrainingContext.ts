'use client';
import { useMemo } from 'react';
import type { Profile } from '../sections/Home/types';
import { trainingContext, type TrainingContext } from '../lib/programSuggest';
import { useWorkoutSummary } from './useWorkoutSummary';

/** Profile + logged bests for exercise suggestions; recomputes whenever either changes. */
export function useTrainingContext(profile: Partial<Profile>): TrainingContext {
  const { summary } = useWorkoutSummary();
  return useMemo(() => trainingContext(profile, (summary?.personalRecords ?? []).map(({ exerciseId, name, loadKg }) => ({ exerciseId, name, loadKg }))), [profile, summary]);
}
