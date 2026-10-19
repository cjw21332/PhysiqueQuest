'use client';
import { api } from '../lib/api';
import { useAppResource } from './useAppResource';

const load = (force?: boolean) => api.getProfile(force);
export function useCurrentProfile() {
  const { data, loading, error, refresh, refreshing } = useAppResource<any>('profile', load);
  return { profile: data ?? null, loading, error, retry: refresh, refreshing };
}
