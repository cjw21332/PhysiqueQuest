'use client';

import type { Profile } from './types';
import { Icon } from './icons';
import { useProgress } from '../../hooks/useProgress';
import { normalizeTrainingDays } from '../../lib/trainingDays';
import { navigate } from '../../lib/navigation';
import { useWorkoutSummary } from '../../hooks/useWorkoutSummary';
import { activityDate } from '../../../shared/workouts';
import { convertMeasurement } from '../../../shared/measurements';

function shortDate(value?: string) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

export default function GoalsMilestones({ profile }: { profile: Profile }) {
  const { entries, loading, error, refresh } = useProgress('weight');
  const training = useWorkoutSummary();
  const workoutLoading = training.loading, workoutError = training.error;
  const orderedEntries = [...entries].sort((a, b) =>
    new Date(b.measuredAt ?? b.date ?? 0).getTime() - new Date(a.measuredAt ?? a.date ?? 0).getTime(),
  );
  const latest = orderedEntries[0];
  const target = Number(profile.targetWeight);
  const start = Number(profile.weight);
  const unit = profile.weightUnit || latest?.unit || 'kg';
  const current = latest ? convertMeasurement(latest.value, latest.unit, unit) : (start > 0 ? start : null);
  const hasTarget = Number.isFinite(target) && target > 0;
  const canMeasureGoalProgress = current !== null && hasTarget && start > 0 && target !== start;
  const progress = canMeasureGoalProgress
    ? Math.min(100, Math.max(0, Math.round((current - start) / (target - start) * 100)))
    : null;
  const goalReached = current !== null && hasTarget && (target < start ? current <= target : target > start ? current >= target : Math.abs(current - target) < 0.05);
  const days = normalizeTrainingDays(profile.days || []);
  const amountToTarget = current !== null && hasTarget ? Math.abs(target - current) : null;
  const targetDate = profile.targetDate
    ? new Date(`${profile.targetDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;
  const weeksLeft = profile.targetDate
    ? Math.max(0, Math.ceil((new Date(`${profile.targetDate}T12:00:00`).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
    : null;
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const startDate = activityDate(weekStart, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const today = activityDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  const workoutsThisWeek = new Set((training.data?.trainingDates ?? []).filter(date => date >= startDate && date <= today)).size;
  const trainingProgress = days.length
    ? Math.min(100, Math.round(workoutsThisWeek / days.length * 100))
    : 0;

  return <div className="home-ref-subview home-ref-goals-page">
    <header className="section-page-head home-ref-page-head">
      <div className="section-back-title">
        <button type="button" className="coach-back" onClick={() => navigate('/home')} aria-label="Back to Home"><Icon name="arrow" size={20}/></button>
        <h2>Goals</h2>
      </div>
      <button type="button" className="home-ref-edit" aria-label="Edit your goals in account settings" onClick={() => navigate('/me')}><Icon name="edit" size={13}/>Edit</button>
    </header>

    <section className="goal-hero home-ref-goal" aria-labelledby="primary-goal-heading">
      <div className="home-ref-goal-top"><small>Primary goal</small>{progress !== null && <b aria-label={`${progress}% of your weight goal`}>{progress}%</b>}</div>
      <div className="goal-hero-title"><h2 id="primary-goal-heading">{profile.goal || 'No goal set'}</h2></div>
      {progress !== null && <div className="goal-progress" role="progressbar" aria-label="Progress toward target weight" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }}/></div>}
      <div className="goal-weights"><b>{current !== null ? `${current} ${unit} now` : 'Log a weight to track progress'}</b><span>{hasTarget ? `${target} ${profile.weightUnit || unit} target` : 'Add a target weight in Me'}</span></div>
      <div className="home-ref-goal-foot">
        <span>{targetDate ? `Target date · ${targetDate}` : 'No target date set'}</span>
        {weeksLeft !== null && <span>{weeksLeft} {weeksLeft === 1 ? 'week' : 'weeks'} left</span>}
      </div>
    </section>

    <section className="subsection home-ref-milestones" aria-labelledby="milestone-heading">
      <div className="section-head"><h3 id="milestone-heading">Milestones</h3><span>{loading ? 'Loading' : error ? 'Unavailable' : `${orderedEntries.length} saved`}</span></div>
      {error && <div role="alert" className="scan-warning">{error}<button type="button" onClick={() => void refresh()}>Retry</button></div>}
      {loading ? <p role="status">Loading saved measurements…</p> : error ? null : orderedEntries.length > 0
        ? <div className="milestone-list home-ref-milestone-list">
          {orderedEntries.slice(0, 3).map((entry, index) => <div className={`milestone ${index === 0 ? 'current' : 'done'}`} key={entry._id}>
            <span className="milestone-dot">{index === 0 ? <span aria-hidden="true">•</span> : <Icon name="check" size={12}/>}</span>
            <div><b>{index === 0 ? 'Current weight' : 'Weight check-in'} · {entry.value} {entry.unit}</b><small>{index === 0 && amountToTarget !== null && !goalReached ? `${amountToTarget.toFixed(1)} ${profile.weightUnit || unit} to target` : `Saved ${shortDate(entry.measuredAt ?? entry.date)}`}</small></div>
          </div>)}
          {hasTarget && <div className={`milestone ${goalReached ? 'done' : ''}`}>
            <span className="milestone-dot">{goalReached ? <Icon name="check" size={12}/> : null}</span>
            <div><b>Target · {target} {profile.weightUnit || unit}</b><small>{goalReached ? 'Goal reached' : 'Upcoming'}</small></div>
          </div>}
        </div>
        : <p>No measurements saved yet. Log your weight in Progress to track this goal.</p>}
    </section>

    <section className="subsection secondary-goals home-ref-secondary" aria-labelledby="secondary-goals-heading">
      <h3 id="secondary-goals-heading">Secondary goals</h3>
      <article className="secondary-goal home-ref-training-goal">
        <span className="mini-progress" role="img" style={{ background: `conic-gradient(var(--green) ${trainingProgress}%, var(--line) 0)` }} aria-label={`${trainingProgress}% of this week's ${days.length} planned training days completed`}>
          <span>{workoutLoading ? '…' : `${trainingProgress}%`}</span>
        </span>
        <div><b>{days.length ? `Train ${days.length}× per week` : 'Set your training days'}</b><small>{days.length ? days.map(day => day.slice(0, 3)).join(' · ') : 'Choose your schedule in Me'}</small></div>
      </article>
      {workoutError && <p className="error" role="alert">{workoutError}</p>}
    </section>
  </div>;
}
