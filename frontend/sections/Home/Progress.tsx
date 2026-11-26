'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useProgress } from '../../hooks/useProgress';
import type { ProgressRecord } from '../../lib/api';
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory';
import { useWorkoutSummary } from '../../hooks/useWorkoutSummary';
import { Icon } from './icons';
import { useRouter } from 'next/navigation';
import DeleteConfirmation from '../../components/DeleteConfirmation';
import WeightModal from '../../components/WeightModal';
import { useCurrentProfile } from '../../hooks/useCurrentProfile';
import TrainingProgress from './TrainingProgress';
import PersonalRecords from './PersonalRecords';
import { titleCase } from '../../lib/titleCase';
import { useActivity } from '../../hooks/useActivity';
import { endOfDay, localDate, localDateString, progressRange, validCustomRange } from '../../lib/progressDates';
import MeasurementChart from './MeasurementChart';
import OutcomeDialog from '../../components/OutcomeDialog';

const choices: { metric: ProgressRecord['metric']; label: string; unit: ProgressRecord['unit'] }[] = [
  { metric: 'weight', label: 'Weight', unit: 'kg' },
  { metric: 'chest', label: 'Chest', unit: 'cm' },
  { metric: 'waist', label: 'Waist', unit: 'cm' },
  { metric: 'arms', label: 'Arms', unit: 'cm' },
];
const tabs = [['overview', 'Overview'], ['exercise', 'Exercises'], ['muscle', 'Muscles'], ['records', 'Records']] as const;

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
  const { push: navigate } = useRouter();
  const [metric, setMetric] = useState<ProgressRecord['metric']>('weight');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState<ProgressRecord | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightNotice, setWeightNotice] = useState('');
  const [view, setView] = useState<'overview' | 'exercise' | 'muscle' | 'records'>('overview');
  const { profile } = useCurrentProfile();
  const { activity, loading: activityLoading, error: activityError, refresh: refreshActivity } = useActivity();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  const [period, setPeriod] = useState<'day'|'week'|'month'|'custom'>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { workouts, workoutLoading, workoutError } = useWorkoutHistory();
  const { summary, loading: summaryLoading, error: summaryError, refresh: refreshSummary } = useWorkoutSummary();
  const weight = useProgress('weight');
  const chest = useProgress('chest');
  const waist = useProgress('waist');
  const arms = useProgress('arms');
  const selected = choices.find(choice => choice.metric === metric)!;
  const selectedProgress = metric === 'weight' ? weight : metric === 'chest' ? chest : metric === 'waist' ? waist : arms;
  const { entries, loading, error, refresh, addMeasurement, deleteMeasurement } = selectedProgress;
  const sortedEntries = entries.map(entry => ({ ...entry, value: selected.unit === 'kg' && entry.unit === 'lb' ? entry.value * 0.45359237 : selected.unit === 'cm' && entry.unit === 'in' ? entry.value * 2.54 : entry.value, unit: selected.unit })).sort((a, b) =>
    new Date(a.measuredAt ?? a.date ?? 0).getTime() - new Date(b.measuredAt ?? b.date ?? 0).getTime(),
  );
  const todayKey = localDateString(now);
  const accountDate = activity.accountCreatedAt ? new Date(activity.accountCreatedAt) : null;
  const accountKey = accountDate && !Number.isNaN(accountDate.getTime()) ? localDateString(accountDate) : '';
  const validAccount = Boolean(accountKey && accountKey <= todayKey);
  const customValid = validCustomRange(from, to, accountKey, todayKey);
  const rangeDates = period === 'custom' ? (customValid ? { start: localDate(from)!, end: localDate(to)! } : null) : progressRange(period, now);
  const fromTime = rangeDates?.start.getTime() ?? Infinity;
  const toTime = rangeDates ? Math.min(endOfDay(rangeDates.end).getTime(), endOfDay(now).getTime()) : -Infinity;
  const chartEntries = sortedEntries.filter(entry => { const date = new Date(entry.measuredAt ?? entry.date ?? '').getTime(); return date >= fromTime && date <= toTime; });
  const firstValue = chartEntries[0]?.value;
  const latestValue = chartEntries.at(-1)?.value;
  const chartStart = rangeDates?.start.getTime() ?? 0;
  const chartEnd = rangeDates ? endOfDay(rangeDates.end).getTime() : 0;
  const delta = chartEntries.length > 1 && firstValue !== undefined && latestValue !== undefined ? latestValue - firstValue : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) { setActionError('Enter a number greater than zero.'); return; }
    setSaving(true); setActionError('');
    try {
      await addMeasurement(amount, selected.unit);
      setValue('');
      setShowEntryForm(false);
      setWeightNotice(`${selected.label} measurement saved to your history.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not save measurement.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setActionError('');
    try { await deleteMeasurement(id); setWeightNotice('Measurement removed from your history.'); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Could not delete measurement.'); }
  };

  const completedWorkouts = workouts
    .filter(workout => workout.status === 'completed' && workout.endedAt)
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());

  return <div className="hm-page hm-progress">
    <header className="hm-pagehead pq-page-heading"><button type="button" className="coach-back" onClick={() => { if (view !== 'overview') setView('overview'); else navigate(new URLSearchParams(window.location.search).get('from') === 'goals' ? '/goals' : '/home'); }} aria-label={view !== 'overview' ? 'Back to Progress overview' : new URLSearchParams(window.location.search).get('from') === 'goals' ? 'Back to Goals' : 'Back to Home'}><Icon name="arrow" size={20}/></button><h1>Progress</h1></header>
    <nav className="hm-segmented hm-tabs" aria-label="Progress sections">{tabs.map(([key, label]) => <button type="button" key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}</nav>

    {view === 'overview' && <div className="hm-stack">
      <section className="hm-stat-grid" aria-label="Your activity summary">
        <div className="hm-stat"><span className="hm-tile-icon hm-tone-green"><Icon name="dumbbell" size={18}/></span><strong>{workoutLoading ? '—' : completedWorkouts.length}</strong><span>Completed workouts</span></div>
        <div className="hm-stat"><span className="hm-tile-icon hm-tone-sky"><Icon name="medal" size={18}/></span><strong>{summaryLoading ? '—' : summary?.personalRecords.filter(record => typeof record.loadKg === 'number' && record.loadKg > 0).length ?? 0}</strong><span>Personal records</span></div>
      </section>

      <section className="hm-card hm-measure" aria-labelledby="hm-measure-title">
        <div className="hm-card-head"><div><span className="hm-eyebrow">Body &amp; measurements</span><h2 id="hm-measure-title">Track your trend</h2></div><button type="button" className="hm-btn hm-btn-primary hm-btn-sm" onClick={() => { if (metric === 'weight' && profile) setWeightOpen(true); else setShowEntryForm(open => !open); setActionError(''); }}><Icon name="plus" size={16}/> Add</button></div>
        <div className="hm-segmented" role="group" aria-label="Choose a measurement">{choices.map(choice => <button type="button" key={choice.metric} aria-pressed={metric === choice.metric} onClick={() => { setMetric(choice.metric); setActionError(''); setShowEntryForm(false); }}>{choice.label}</button>)}</div>
        {error && <div role="alert" className="hm-state hm-state-error">{error} <button type="button" onClick={() => void refresh()}>Retry</button></div>}
        <div className="hm-measure-value">
          <div><span className="hm-meta">{selected.label}</span><strong>{latestValue === undefined ? '—' : formatValue(latestValue)} <small>{latestValue === undefined ? '' : selected.unit}</small></strong></div>
          {delta !== null && <span className={`hm-pill${delta === 0 ? '' : ' hm-tone-green'}`}>{delta === 0 ? 'No change' : `${delta > 0 ? '+' : '−'}${formatValue(Math.abs(delta))} ${selected.unit}`}</span>}
        </div>
        <p className="hm-meta">{delta !== null ? 'Change across selected period' : entries.length ? 'No comparison for this period' : 'Add your first measurement to see your trend'}</p>
        {showEntryForm && metric !== 'weight' && <form onSubmit={event => void submit(event)} className="hm-entry-form"><label className="hm-field-label">Log {selected.label.toLowerCase()} ({selected.unit})<input className="hm-input" inputMode="decimal" type="number" min="0.1" step="any" value={value} onChange={event => setValue(event.target.value)} required /></label><button type="submit" className="hm-btn hm-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save measurement'}</button></form>}
        <div className="hm-segmented hm-segmented-sm" role="group" aria-label="Progress date range">{(['day','week','month','custom'] as const).map(option => <button key={option} type="button" aria-pressed={period === option} onClick={() => setPeriod(option)}>{option === 'day' ? 'Day' : option === 'week' ? 'Week' : option === 'month' ? 'Month' : 'Custom'}</button>)}</div>
        {period === 'custom' && <div className="hm-dates"><label className="hm-field-label">From<input className="hm-input" type="date" value={from} min={validAccount ? accountKey : undefined} max={to && to <= todayKey ? to : todayKey} disabled={!validAccount} onChange={e => setFrom(e.target.value)}/></label><label className="hm-field-label">To<input className="hm-input" type="date" value={to} min={from && from >= accountKey ? from : accountKey} max={todayKey} disabled={!validAccount} onChange={e => setTo(e.target.value)}/></label>{!validAccount ? <p role="status" className="hm-meta">{activityLoading ? 'Loading your account date…' : 'Your account date is unavailable. '}{!activityLoading && <button type="button" onClick={() => void refreshActivity()}>Retry</button>}</p> : from && to && !customValid ? <p role="alert" className="hm-meta">Choose dates from your account creation date through today, with From on or before To.</p> : !from || !to ? <p className="hm-meta">Choose a start and end date.</p> : null}{activityError && !validAccount && <p role="alert" className="hm-meta">{activityError}</p>}</div>}
        {rangeDates && <p className="hm-range" aria-label="Selected date range"><Icon name="calendar" size={13}/>{shortDate(rangeDates.start.toISOString())}{period === 'day' ? '' : ` – ${shortDate(rangeDates.end.toISOString())}`}{period === 'month' ? ' (Today)' : ''}</p>}
        {loading ? <p role="status" className="hm-state">Loading measurements…</p> : chartEntries.length ? <MeasurementChart entries={chartEntries} label={selected.label} unit={selected.unit} period={period} start={chartStart} end={chartEnd} now={now}/> : <div className="hm-empty hm-empty-inline"><p>{period === 'custom' && !customValid ? 'Select a valid date range to see measurements.' : 'No measurements in this period.'}</p></div>}
        {!!entries.length && <details className="hm-disclosure"><summary>Measurement history <span className="hm-count">{entries.length}</span></summary><ul>{[...sortedEntries].reverse().map(entry => <li key={entry._id}><span><b>{formatValue(entry.value)} {entry.unit}</b><small>{shortDate(entry.measuredAt ?? entry.date)}</small></span><button type="button" className="hm-icon-btn hm-icon-btn-danger" aria-label={`Delete ${entry.value} ${entry.unit} measurement`} onClick={() => setDeleting(entry)}><Icon name="trash" size={16}/></button></li>)}</ul></details>}
      </section>

      <section className="hm-block" aria-labelledby="hm-sessions-title"><div className="hm-block-head"><h2 id="hm-sessions-title">Recent sessions</h2></div>{workoutError ? <p role="alert" className="hm-state hm-state-error">{workoutError}</p> : workoutLoading ? <p role="status" className="hm-state">Loading sessions…</p> : completedWorkouts.length ? <div className="hm-card hm-list">{completedWorkouts.slice(0, 3).map(workout => <article key={workout._id} className="hm-list-row"><span className="hm-tile-icon hm-tone-green"><Icon name="strength" size={17}/></span><span className="hm-row-copy"><b>{titleCase(workout.routineName || 'Workout session')}</b><span>{shortDate(workout.startedAt)} · {workout.exerciseIds.length} exercises</span></span><strong>{workout.durationSeconds === undefined ? '' : `${Math.round(workout.durationSeconds / 60)} min`}</strong></article>)}</div> : <div className="hm-empty hm-empty-inline"><p>Your completed workouts will appear here.</p></div>}</section>
      <button type="button" className="hm-row-card" onClick={() => setView('records')}><span className="hm-tile-icon hm-tone-sky"><Icon name="medal" size={19}/></span><span className="hm-row-copy"><b>Personal records</b><span>Celebrate your best performances</span></span><Icon name="chevron-right" size={18}/></button>
    </div>}

    {(view === 'exercise' || view === 'muscle') && <div className="hm-stack">{workoutLoading ? <p role="status" className="hm-state">Loading training history…</p> : workoutError ? <p role="alert" className="hm-state hm-state-error">{workoutError}</p> : <TrainingProgress workouts={workouts} tab={view}/>}</div>}

    {view === 'records' && <div className="hm-stack"><PersonalRecords records={summary?.personalRecords ?? []} loading={summaryLoading} error={summaryError} retry={() => void refreshSummary()}/></div>}
    {deleting && <DeleteConfirmation title="Delete this measurement?" description={`${deleting.value} ${deleting.unit} will be removed from your progress history.`} confirmLabel="Delete measurement" onCancel={() => setDeleting(null)} onConfirm={() => { void remove(deleting._id); setDeleting(null); }}/>}
    {weightOpen && profile && <WeightModal profile={profile} onClose={() => setWeightOpen(false)} onSaved={message => { setWeightOpen(false); setWeightNotice(message); void weight.refresh(); }}/>}
    {actionError && <OutcomeDialog kind="error" title="Something went wrong" message={actionError} onClose={() => setActionError('')} actionLabel="Got it"/>}
    {weightNotice && <OutcomeDialog kind={/but|not changed|choose|review/i.test(weightNotice) ? 'info' : 'success'} title={/but|not changed|choose|review/i.test(weightNotice) ? 'Update details' : 'Measurement updated'} message={weightNotice} onClose={() => setWeightNotice('')}/>}
  </div>;
}
