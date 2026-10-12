'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, type CoachPlanRecord } from '../lib/api';

export function useCoachPlan() {
  const [plan, setPlan] = useState<CoachPlanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setPlan(await api.getCoachPlan()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load your plan.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { plan, loading, error, refresh };
}
