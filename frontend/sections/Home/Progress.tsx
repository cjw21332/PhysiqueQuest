'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useProgress } from '../../hooks/useProgress';
import type { ProgressRecord, WorkoutSessionRecord } from '../../lib/api';
import { api } from '../../lib/api';
import { Icon } from './icons';
import { navigate } from '../../lib/navigation';
import { useWorkoutSummary } from '../../hooks/useWorkoutSummary';
import { convertMeasurement } from '../../../shared/measurements';

const choices: { metric: ProgressRecord['metric']; label: string; unit: ProgressRecord['unit'] }[] = [
  { metric: 'weight', label: 'Weight', unit: 'kg' },
  { metric: 'waist', label: 'Waist', unit: 'cm' },
  { metric: 'benchPress', label: 'Bench press', unit: 'kg' },
];

function shortDate(value?: string) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function formatValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function Progress() {
  const training = useWorkoutSummary();
  const [metric, setMetric] = useState<ProgressRecord['metric']>('weight');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [actionError, setActionError] = useState('');
  const [workouts, setWorkouts] = useState<WorkoutSessionRecord[]>([]);
  const [workoutLoading, setWorkoutLoading] = useState(true);
  const [workoutError, setWorkoutError] = useState('');
  const weight = useProgress('weight');
  const waist = useProgress('waist');
  const benchPress = useProgress('benchPress');
  const selected = choices.find(choice => choice.metric === metric)!;
  const selectedProgress = metric === 'weight' ? weight : metric === 'waist' ? waist : benchPress;
  const { entries, loading, error, refresh, addMeasurement, deleteMeasurement } = selectedProgress;
  const sortedEntries = entries.map(entry => ({ ...entry, value: convertMeasurement(entry.value, entry.unit, selected.unit), unit: selected.unit })).sort((a, b) =>
    new Date(a.measuredAt ?? a.date ?? 0).getTime() - new Date(b.measuredAt ?? b.date ?? 0).getTime(),
  );
  const chartEntries = sortedEntries.slice(-8);
  const firstValue = chartEntries[0]?.value;
  const latestValue = chartEntries.at(-1)?.value;
  const firstDate = new Date(chartEntries[0]?.measuredAt ?? chartEntries[0]?.date ?? '');
  const lastDate = new Date(chartEntries.at(-1)?.measuredAt ?? chartEntries.at(-1)?.date ?? '');
  const elapsedWeeks = Number.isNaN(firstDate.getTime()) || Number.isNaN(lastDate.getTime())
    ? chartEntries.length
    : Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  const range = chartEntries.length > 1
    ? Math.max(...chartEntries.map(entry => entry.value)) - Math.min(...chartEntries.map(entry => entry.value))
    : 0;

  useEffect(() => {
    let active = true;
    api.getWorkouts().then(records => {
      if (active) setWorkouts(records);
    }).catch(loadError => {
      if (active) setWorkoutError(loadError instanceof Error ? loadError.message : 'Could not load recent workouts.');
    }).finally(() => {
      if (active) setWorkoutLoading(false);
    });
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) { setActionError('Enter a number greater than zero.'); return; }
    setSaving(true); setActionError('');
    try {
      await addMeasurement(amount, selected.unit);
      setValue('');
      setShowEntryForm(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not save measurement.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setActionError('');
    try { await deleteMeasurement(id); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Could not delete measurement.'); }
  };

  const completedWorkouts = workouts
    .filter(workout => workout.status === 'completed' && workout.endedAt)
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
  const realRecords = (training.data?.personalRecords ?? []).map(record => ({ label: record.name, value: `${record.durationSeconds === undefined ? `${record.reps} reps` : `${record.durationSeconds} seconds`}${record.loadKg === undefined ? '' : ` at ${record.loadKg} kg`}`, date: record.date }));

  return <div className="home-ref-subview home-ref-progress home-ref-progress-page">
    <header className="section-page-head home-ref-page-head">
      <div className="section-back-title">
        <button type="button" className="coach-back" onClick={() => navigate('/home')} aria-label="Back to Home"><Icon name="arrow" size={20}/></button>
        <h2>Progress</h2>
      </div>
      <button type="button" className="home-ref-edit" aria-expanded={showEntryForm} onClick={() => { setShowEntryForm(open => !open); setActionError(''); }}>
        <Icon name="edit" size={14}/>{showEntryForm ? 'Close' : 'Add measurement'}
      </button>
    </header>

    <section className="progress-overview home-ref-progress-overview">
      <div className="metric-tabs home-ref-metric-tabs" role="group" aria-label="Choose a measurement">
        {choices.map(choice => <button type="button" key={choice.metric} aria-pressed={metric === choice.metric} className={metric === choice.metric ? 'active' : ''} onClick={() => { setMetric(choice.metric); setActionError(''); }}>
          {choice.label}
        </button>)}
      </div>

      {error && <div role="alert" className="scan-warning">{error}<button type="button" onClick={() => void refresh()}>Retry</button></div>}
      {actionError && <p className="error" role="alert">{actionError}</p>}
      {loading ? <p role="status">Loading {selected.label.toLowerCase()} history…</p> : <section className="home-ref-trend" aria-label={`${selected.label} trend`}>
        <div className="home-ref-measurement">
          <strong>{latestValue === undefined ? '—' : `${formatValue(latestValue)} ${selected.unit}`}</strong>
          {chartEntries.length > 1 && firstValue !== undefined && latestValue !== undefined
            ? <span className="home-ref-change">{latestValue === firstValue ? 'No change' : `${latestValue > firstValue ? '+' : '−'}${formatValue(Math.abs(latestValue - firstValue))} ${selected.unit}`} in {elapsedWeeks} {elapsedWeeks === 1 ? 'week' : 'weeks'}</span>
            : <span className="home-ref-change">{entries.length ? 'Latest saved measurement' : 'Your history will appear after your first measurement'}</span>}
        </div>
        {chartEntries.length ? <div className="home-ref-chart" role="img" aria-label={`${selected.label} values from ${shortDate(chartEntries[0]?.measuredAt ?? chartEntries[0]?.date)} to ${shortDate(chartEntries.at(-1)?.measuredAt ?? chartEntries.at(-1)?.date)}`}>
          {chartEntries.map((entry, index) => {
            const barHeight = range > 0 ? 22 + ((entry.value - Math.min(...chartEntries.map(item => item.value)))/range) * 70 : 58;
            return <div className="home-ref-chart-column" key={entry._id}>
              <span className={index === chartEntries.length - 1 ? 'latest' : ''} style={{ height: `${barHeight}%` }} />
              <small>{`W${index + 1}`}</small>
            </div>;
          })}
        </div> : <div className="home-ref-chart-empty">Log your first {selected.label.toLowerCase()} to start a trend.</div>}
        {!!entries.length && <details className="home-ref-history">
          <summary>{selected.label} history ({entries.length})</summary>
          <div className="history-records">{[...sortedEntries].reverse().map(entry => <div className="history-entry" key={entry._id}>
            <span><b>{formatValue(entry.value)} {entry.unit}</b><small>{entry.measuredAt ? new Date(entry.measuredAt).toLocaleString() : shortDate(entry.date)}</small></span>
            <button type="button" aria-label={`Delete ${entry.value} ${entry.unit} measurement`} onClick={() => void remove(entry._id)}>Delete</button>
          </div>)}</div>
        </details>}
      </section>}

      {showEntryForm && <form onSubmit={event => void submit(event)} className="progress-entry-form home-ref-entry-form">
        <label>Log {selected.label.toLowerCase()} ({selected.unit})<input inputMode="decimal" type="number" min="0.1" step="any" value={value} onChange={event => setValue(event.target.value)} placeholder={`Enter ${selected.unit}`} required /></label>
        <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save measurement'}</button>
      </form>}
    </section>

    <section className="subsection home-ref-records" aria-labelledby="progress-records-heading">
      <div className="section-head">
        <h3 id="progress-records-heading">Personal records</h3>
      </div>
      {training.error ? <p className="error" role="alert">{training.error}</p> : training.loading ? <p role="status">Loading personal records…</p> : <div className="home-ref-record-list">
        {!realRecords.length && <p>No saved set records yet. Log a set in Coach to start tracking.</p>}
        {realRecords.map(record => {
          const date = 'date' in record ? record.date : '';
          const detail = record.value;
          return <article className="home-ref-record home-ref-personal-record" key={record.label}>
            <span className="record-icon"><Icon name="dumbbell" size={16}/></span>
            <span className="home-ref-record-copy"><b>{record.label}</b><small>{date}</small></span>
            <strong>{detail}</strong>
          </article>;
        })}
      </div>}
    </section>

    <section className="subsection home-ref-accuracy" aria-labelledby="form-accuracy-heading">
      <div className="section-head">
        <h3 id="form-accuracy-heading">Form accuracy</h3>
      </div>
      <p>Form accuracy is not measured by the rep counter. Reviewed reps and loads appear in your records above.</p>
    </section>

    <section className="subsection home-ref-sessions" aria-labelledby="recent-sessions-heading">
      <div className="section-head">
        <h3 id="recent-sessions-heading">Recent sessions</h3>
      </div>
      {workoutError ? <p className="error" role="alert">{workoutError}</p> : workoutLoading ? <p role="status">Loading recent sessions…</p>
        : <div className="home-ref-session-list">{!completedWorkouts.length && <p>No completed sessions yet.</p>}{completedWorkouts.slice(0, 3).map(workout => <article className="home-ref-session-row" key={workout._id}>
          <span><button className="quiet-link" onClick={() => navigate(`/workouts/${workout._id}`)}>{workout.exercises?.[0]?.name ?? 'Workout session'}</button><small>{shortDate(workout.startedAt)}</small></span>
          <span className="home-ref-session-detail">{workout.exerciseIds.length} exercises{workout.durationSeconds === undefined ? '' : ` · ${Math.round(workout.durationSeconds / 60)} min`}<Icon name="arrow" size={13}/></span>
        </article>)}</div>}
    </section>
  </div>;
}

