'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, type LeaderboardPeriod, type LeaderboardRecord } from '../lib/api';

export function useLeaderboard(period: LeaderboardPeriod) {
  const [data, setData] = useState<LeaderboardRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api.getLeaderboard(period)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load the leaderboard.'); }
    finally { setLoading(false); }
  }, [period]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}
