'use client';

import { useEffect } from 'react';
import { api } from '../lib/api';
import { getCurrentUser } from '../lib/auth';
import { navigate } from '../lib/navigation';
import { useApiResource } from './useApiResource';

export function useCurrentProfile() {
  const resource = useApiResource('profile', () => api.getProfile());
  useEffect(() => { if (!getCurrentUser()?.token) navigate('/launch'); }, []);
  return { profile: resource.data ?? null, loading: resource.loading, error: resource.error, retry: resource.refresh };
}
