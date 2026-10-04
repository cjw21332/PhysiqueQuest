'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, type ProgressRecord } from '../lib/api';

export function useProgress(metric: ProgressRecord['metric']) {
  const [entries, setEntries] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setEntries(await api.getProgress(metric)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load progress.'); }
    finally { setLoading(false); }
  }, [metric]);
  useEffect(() => { void refresh(); }, [refresh]);
  const addMeasurement = useCallback(async (value: number, unit: ProgressRecord['unit']) => {
    setError('');
    try { await api.addProgress({ metric, value, unit, measuredAt: new Date().toISOString() }); await refresh(); }
    catch (err) { const message = err instanceof Error ? err.message : 'Could not save measurement.'; setError(message); throw err; }
  }, [metric, refresh]);
  const deleteMeasurement = useCallback(async (id: string) => {
    setError('');
    try { await api.deleteProgress(id); await refresh(); }
    catch (err) { const message = err instanceof Error ? err.message : 'Could not delete measurement.'; setError(message); throw err; }
  }, [refresh]);
  return { entries, loading, error, refresh, addMeasurement, deleteMeasurement };
}
