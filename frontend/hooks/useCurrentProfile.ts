'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { getCurrentUser, PROFILE_STORAGE_KEY } from '../lib/auth';

export function useCurrentProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const user = getCurrentUser();
      if (!user?.token) {
        router.replace('/launch');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const savedProfile = await api.getProfile();
        if (!active) return;
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(savedProfile));
        setProfile(savedProfile);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load your profile.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProfile();
    return () => { active = false; };
  }, [attempt, router]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { profile, loading, error, retry };
}
