'use client';
import { useCallback, useState } from 'react';
import { api, type ProgressRecord } from '../lib/api';
import { useAppResource } from './useAppResource';

export function useProgress(metric: ProgressRecord['metric']) {
  const load = useCallback((force?: boolean) => api.getProgress(metric, 90, force), [metric]);
  const { data, loading, error, refresh } = useAppResource<ProgressRecord[]>(`progress:${metric}`, load);
  const [actionError, setActionError] = useState('');
  const addMeasurement = useCallback(async (value: number, unit: ProgressRecord['unit']) => {
    setActionError('');
    try { await api.addProgress({ metric, value, unit, measuredAt: new Date().toISOString() }); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Could not save measurement.'); throw err; }
    await refresh();
  }, [metric, refresh]);
  const deleteMeasurement = useCallback(async (id: string) => {
    setActionError('');
    try { await api.deleteProgress(id); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Could not delete measurement.'); throw err; }
    await refresh();
  }, [refresh]);
  return { entries: data ?? [], loading, error: actionError || error, refresh, addMeasurement, deleteMeasurement };
}
