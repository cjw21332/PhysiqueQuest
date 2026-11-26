'use client';
import { api, type SavedProgram } from '../lib/api';
import { useAppResource } from './useAppResource';

const load = (force?: boolean) => api.getSavedPrograms(force);
export function useSavedPrograms() {
  const { data, loading, error, refresh } = useAppResource<{ items: SavedProgram[] }>('saved-programs', load);
  return { programs: data?.items ?? [], loading, error, refresh };
}
