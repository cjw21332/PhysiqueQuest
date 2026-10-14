'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type CoachPlanRecord } from '../lib/api';

export function useCoachPlan(profile?: Record<string, unknown>) {
  const [plan, setPlan] = useState<CoachPlanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true); setError('');
    try { const next = await api.getCoachPlan(); if (current === requestId.current) setPlan(next); }
    catch (err) { if (current === requestId.current) setError(err instanceof Error ? err.message : 'Could not load your plan.'); }
    finally { if (current === requestId.current) setLoading(false); }
  }, [profile]);
  useEffect(() => { void refresh(); return () => { ++requestId.current; }; }, [refresh]);
  return { plan, loading, error, refresh };
}
