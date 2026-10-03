'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getCurrentUser, PROFILE_STORAGE_KEY } from '../lib/auth';
import { navigate } from '../lib/navigation';

export function useCurrentProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const user = getCurrentUser();
      if (!user?.token) {
        navigate('/launch');
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
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { profile, loading, error, retry };
}
