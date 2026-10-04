'use client';

import { useState, type FormEvent } from 'react';
import { useProgress } from '../../hooks/useProgress';
import type { ProgressRecord } from '../../lib/api';
import { Icon } from './icons';

const choices: { metric: ProgressRecord['metric']; label: string; unit: ProgressRecord['unit'] }[] = [
  { metric: 'weight', label: 'Weight', unit: 'kg' },
  { metric: 'waist', label: 'Waist', unit: 'cm' },
  { metric: 'benchPress', label: 'Bench press', unit: 'kg' },
];

export default function Progress({ onBack }: { onBack: () => void }) {
  const [metric, setMetric] = useState<ProgressRecord['metric']>('weight');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const selected = choices.find(choice => choice.metric === metric)!;
  const { entries, loading, error, refresh, addMeasurement, deleteMeasurement } = useProgress(metric);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) { setActionError('Enter a number greater than zero.'); return; }
    setSaving(true); setActionError('');
    try { await addMeasurement(amount, selected.unit); setValue(''); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Could not save measurement.'); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => { setActionError(''); try { await deleteMeasurement(id); } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not delete measurement.'); } };

  return <>
    <header className="section-page-head"><div className="section-back-title"><button className="coach-back" onClick={onBack} aria-label="Back to Home"><Icon name="arrow" size={24}/></button><h2>Progress</h2></div></header>
    <section className="progress-overview">
      <div className="metric-tabs">{choices.map(choice => <button key={choice.metric} className={metric === choice.metric ? 'active' : ''} onClick={() => { setMetric(choice.metric); setActionError(''); }}>{choice.label}</button>)}</div>
      <form onSubmit={event => void submit(event)} className="progress-entry-form"><label>Log {selected.label.toLowerCase()} ({selected.unit})<input inputMode="decimal" type="number" min="0.1" step="any" value={value} onChange={event => setValue(event.target.value)} placeholder={`Enter ${selected.unit}`} required /></label><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save measurement'}</button></form>
      {(error || actionError) && <div role="alert" className="scan-warning">{error || actionError}<button onClick={() => void refresh()}>Retry</button></div>}
      {loading ? <p role="status">Loading measurements…</p> : entries.length === 0 ? <p className="progress-empty">No measurements yet. Your history will appear here after you save one.</p> : <section className="history-records"><h3>{selected.label} history</h3>{[...entries].reverse().map(entry => <div className="history-entry" key={entry._id}><span><b>{entry.value} {entry.unit}</b><small>{entry.measuredAt ? new Date(entry.measuredAt).toLocaleString() : 'Date unavailable'}</small></span><button type="button" aria-label={`Delete ${entry.value} ${entry.unit} measurement`} onClick={() => void remove(entry._id)}>Delete</button></div>)}</section>}
    </section>
    <p className="scan-warning">Workout history and form analysis will appear when those services provide saved records.</p>
  </>;
}
