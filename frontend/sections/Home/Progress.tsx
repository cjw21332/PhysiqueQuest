'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useProgress } from '../../hooks/useProgress';
import type { ProgressRecord, WorkoutSessionRecord } from '../../lib/api';
import { api } from '../../lib/api';
import { Icon } from './icons';
import { useRouter } from 'next/navigation';

const choices: { metric: ProgressRecord['metric']; label: string; unit: ProgressRecord['unit'] }[] = [
  { metric: 'weight', label: 'Weight', unit: 'kg' },
  { metric: 'waist', label: 'Waist', unit: 'cm' },
  { metric: 'benchPress', label: 'Bench press', unit: 'kg' },
];

const samplePersonalRecords = [
  { label: 'Bench press', value: '62.5 kg', date: 'Set Nov 18' },
  { label: 'Squat', value: '90 kg', date: 'Set Nov 16' },
  { label: 'Deadlift', value: '110 kg', date: 'Set Nov 09' },
];

const sampleSessions = [
  { title: 'Upper Body — Push', date: 'Nov 18', score: 88 },
  { title: 'Lower Body', date: 'Nov 16', score: 84 },
  { title: 'Upper Body — Pull', date: 'Nov 14', score: 81 },
];

const sampleFormScores = [35, 42, 49, 57, 64, 71, 80, 88];

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

function personalRecords(workouts: WorkoutSessionRecord[]) {
  const records = new Map<string, { label: string; load: number; date: string }>();
  for (const workout of workouts) {
    for (const result of workout.exerciseResults ?? []) {
      if (!result.loadKg || result.loadKg <= 0 || /^[a-f\d]{24}$/i.test(result.exerciseId)) continue;
      const label = result.exerciseId
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, character => character.toUpperCase());
      const current = records.get(result.exerciseId);
      if (!current || result.loadKg > current.load) {
        records.set(result.exerciseId, { label, load: result.loadKg, date: shortDate(workout.startedAt) });
      }
    }
  }
  return [...records.values()]
    .sort((left, right) => right.load - left.load)
    .slice(0, 3);
}

export default function Progress() {
  const { push: navigate } = useRouter();
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
  const sortedEntries = [...entries].sort((a, b) =>
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
  const realRecords = personalRecords(completedWorkouts);
  const showSampleRecords = realRecords.length === 0 && !workoutLoading && !workoutError;
  const showSampleSessions = completedWorkouts.length === 0 && !workoutLoading && !workoutError;

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
            const barHeight = range > 0 ? 42 + ((entry.value - Math.min(...chartEntries.map(item => item.value)))/range) * 50 : 58;
            return <div className="home-ref-chart-column" key={entry._id}>
              <span className={index === chartEntries.length - 1 ? 'latest' : ''} style={{ height: `${barHeight}%` }} />
              <small>{index % 2 === 0 || index === chartEntries.length - 1 ? `W${index + 1}` : ''}</small>
            </div>;
          })}
        </div> : <div className="home-ref-chart-empty">Log your first {selected.label.toLowerCase()} to start a trend.</div>}

      </section>}

      {showEntryForm && <form onSubmit={event => void submit(event)} className="progress-entry-form home-ref-entry-form">
        <label>Log {selected.label.toLowerCase()} ({selected.unit})<input inputMode="decimal" type="number" min="0.1" step="any" value={value} onChange={event => setValue(event.target.value)} placeholder={`Enter ${selected.unit}`} required /></label>
        <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save measurement'}</button>
      </form>}
    </section>

    <section className="subsection home-ref-records" aria-labelledby="progress-records-heading">
      <div className="section-head">
        <h3 id="progress-records-heading">Personal records</h3>
        {showSampleRecords && <span className="home-ref-sample-label">Sample data</span>}
      </div>
      {workoutError ? <p className="error" role="alert">{workoutError}</p> : workoutLoading ? <p role="status">Loading personal records…</p> : <div className="home-ref-record-list">
        {(showSampleRecords ? samplePersonalRecords : realRecords).map(record => {
          const date = 'date' in record ? record.date : '';
          const detail = 'value' in record ? record.value : `${formatValue(record.load)} kg`;
          return <article className="home-ref-record home-ref-personal-record" key={record.label}>
            <span className="record-icon"><Icon name="trophy" size={16}/></span>
            <span className="home-ref-record-copy"><b>{record.label}</b><small>{date}</small></span>
            <strong>{detail}</strong>
          </article>;
        })}
      </div>}
    </section>

    <section className="subsection home-ref-accuracy" aria-labelledby="form-accuracy-heading">
      <div className="section-head">
        <h3 id="form-accuracy-heading">Form accuracy</h3>
        <span>8 weeks <span className="home-ref-sample-label">Sample</span></span>
      </div>
      <div className="home-ref-accuracy-card"><div className="home-ref-accuracy-chart" role="img" aria-label="Sample form accuracy trend improves from 35 percent in week one to 88 percent in week eight">
        {sampleFormScores.map((score, index) => <div className="home-ref-accuracy-column" key={index}>
          <span className={index === sampleFormScores.length - 1 ? 'latest' : ''} style={{ height: `${score}%` }} />
          <small>{index === 0 ? 'W1' : index === 2 ? 'W3' : index === 4 ? 'W5' : index === 6 ? 'W7' : index === 7 ? 'W8' : ''}</small>
        </div>)}
      </div>
      <p>Average form score improved from <b>58%</b> to <b>88%</b>.</p></div>
    </section>

    <section className="subsection home-ref-sessions" aria-labelledby="recent-sessions-heading">
      <div className="section-head">
        <h3 id="recent-sessions-heading">Recent sessions</h3>
        {showSampleSessions && <span className="home-ref-sample-label">Sample data</span>}
      </div>
      {workoutError ? <p className="error" role="alert">{workoutError}</p> : workoutLoading ? <p role="status">Loading recent sessions…</p> : showSampleSessions
        ? <div className="home-ref-session-list">{sampleSessions.map(session => <article className="home-ref-session-row" key={session.title}>
          <span><b>{session.title}</b><small>{session.date}</small></span>
          <span className="home-ref-session-detail">{session.score}% form<Icon name="arrow" size={13}/></span>
        </article>)}</div>
        : <div className="home-ref-session-list">{completedWorkouts.slice(0, 3).map(workout => <article className="home-ref-session-row" key={workout._id}>
          <span><b>Workout session</b><small>{shortDate(workout.startedAt)}</small></span>
          <span className="home-ref-session-detail">{workout.exerciseIds.length} exercises{workout.durationSeconds === undefined ? '' : ` · ${Math.round(workout.durationSeconds / 60)} min`}<Icon name="arrow" size={13}/></span>
        </article>)}</div>}
    </section>
        {!!entries.length && <details className="home-ref-history">
          <summary>{selected.label} history ({entries.length})</summary>
          <div className="history-records">{[...sortedEntries].reverse().map(entry => <div className="history-entry" key={entry._id}>
            <span><b>{formatValue(entry.value)} {entry.unit}</b><small>{entry.measuredAt ? new Date(entry.measuredAt).toLocaleString() : shortDate(entry.date)}</small></span>
            <button type="button" aria-label={`Delete ${entry.value} ${entry.unit} measurement`} onClick={() => void remove(entry._id)}>Delete</button>
          </div>)}</div>
        </details>}
  </div>;
}
