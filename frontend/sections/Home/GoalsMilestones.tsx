'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile } from './types';
import { Icon } from './icons';
import Ring from './Ring';
import { useProgress } from '../../hooks/useProgress';
import { useWorkoutSummary } from '../../hooks/useWorkoutSummary';
import { normalizeTrainingDays, TRAINING_DAYS } from '../../lib/trainingDays';
import { formatLocalDate } from '../../lib/localDate.mjs';
import WeightModal from '../../components/WeightModal';

function shortDate(value?: string) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GoalsMilestones({ profile, refreshProfile }: { profile: Profile; refreshProfile: () => Promise<unknown> }) {
  const { push } = useRouter();
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightNotice, setWeightNotice] = useState('');
  const { entries, loading, error, refresh } = useProgress('weight');
  const { summary, loading: workoutLoading, error: workoutError, refresh: refreshWorkouts } = useWorkoutSummary();
  const ordered = [...entries].sort((a, b) => new Date(b.measuredAt ?? b.date ?? 0).getTime() - new Date(a.measuredAt ?? a.date ?? 0).getTime());
  const unit = profile.weightUnit === 'lbs' || profile.weightUnit === 'lb' ? 'lb' : 'kg';
  const target = Number(profile.targetWeight);
  const current = Number(profile.weight);
  const hasCurrent = Number.isFinite(current) && current > 0;
  const hasTarget = Number.isFinite(target) && target > 0;
  const difference = hasCurrent && hasTarget ? Math.abs(target - current) : null;
  const reached = difference !== null && difference < 0.05;
  const days = normalizeTrainingDays(profile.days || []);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const workouts = summary?.trainingDates.filter(date => date >= formatLocalDate(weekStart) && date <= formatLocalDate()).length ?? 0;
  const percent = days.length ? Math.min(100, Math.round(workouts / days.length * 100)) : 0;
  const targetDate = profile.targetDate ? new Date(`${profile.targetDate}T12:00:00`) : null;
  const validDate = targetDate && !Number.isNaN(targetDate.getTime()) ? targetDate : null;
  const pastTarget = !!validDate && profile.targetDate! < formatLocalDate();

  return <div className="hm-page hm-goals">
    <header className="hm-pagehead pq-page-heading">
      <button type="button" className="coach-back" onClick={() => push('/home')} aria-label="Back to Home"><Icon name="arrow" size={20}/></button>
      <h1>Goals</h1>
      <button type="button" className="hm-btn hm-btn-soft hm-btn-sm" onClick={() => push('/me/goals?from=goals')}><Icon name="edit" size={15}/> Edit</button>
    </header>

    <section className="hm-hero hm-goal-hero" aria-labelledby="goal-primary">
      <div className="hm-hero-top"><span className="hm-eyebrow"><Icon name="target" size={14}/> Primary goal</span><span className="hm-pill">Your focus</span></div>
      <h2 id="goal-primary">{profile.goal || 'Choose your goal'}</h2>
      <p className="hm-hero-sub">{profile.goal ? 'A little progress adds up. Keep showing up for yourself.' : 'Set a goal to give your training a direction.'}</p>
      <div className="hm-goal-path">
        <div><small>Current</small><strong>{hasCurrent ? <>{current.toLocaleString()}<span> {unit}</span></> : 'Not set'}</strong><em>Profile weight</em></div>
        <span className="hm-goal-arrow" aria-hidden="true"><Icon name="arrow" size={18}/></span>
        <div><small>Target</small><strong>{hasTarget ? <>{target.toLocaleString()}<span> {unit}</span></> : 'Not set'}</strong><em>Your goal</em></div>
      </div>
      <p className="hm-goal-gap"><Icon name={reached ? 'check-circle' : 'target'} size={16}/><span>{difference === null ? 'Add a current and target weight to compare.' : reached ? 'You’re at your target weight.' : `${Number(difference.toFixed(1))} ${unit} ${current < target ? 'below' : 'above'} your target`}</span></p>
      <div className="hm-hero-actions"><button type="button" className="hm-btn hm-btn-primary" onClick={() => setWeightOpen(true)}><Icon name="scale" size={17}/> Update weight</button><button type="button" className="hm-btn hm-btn-ghost" onClick={() => push('/me/goals?from=goals')}>{profile.goal ? 'Edit goal' : 'Set a goal'}</button></div>
      {weightNotice && <p className="hm-feedback" role="status">{weightNotice}</p>}
    </section>

    <button type="button" className="hm-row-card" onClick={() => push('/me/goals?from=goals')} aria-label="Edit target date"><span className="hm-tile-icon hm-tone-sky"><Icon name="calendar" size={19}/></span><span className="hm-row-copy"><small>Target date</small><b>{validDate ? shortDate(validDate.toISOString()) : 'No date set'}</b><span>{pastTarget ? 'This date has passed. Review it whenever you’re ready.' : validDate ? 'Your personal target, not a deadline.' : 'A date is optional. Set one in your goal settings.'}</span></span><Icon name="chevron-right" size={18}/></button>

    <section className="hm-block" aria-labelledby="training-heading">
      <div className="hm-block-head"><h2 id="training-heading">This week’s training</h2><button type="button" className="hm-link" onClick={() => push('/me/training?from=goals')}>Schedule <Icon name="chevron-right" size={14}/></button></div>
      <div className="hm-card hm-week-card">
        <div className="hm-week-top">
          {!workoutLoading && !workoutError && days.length > 0
            ? <span role="progressbar" aria-label="Weekly training days completed" aria-valuemin={0} aria-valuemax={days.length} aria-valuenow={Math.min(workouts, days.length)}><Ring percent={percent} size={58} stroke={6}><b>{workouts}</b><small>of {days.length}</small></Ring></span>
            : <span className="hm-tile-icon hm-tone-green"><Icon name="dumbbell" size={20}/></span>}
          <div><b>{days.length ? `${days.length} ${days.length === 1 ? 'day' : 'days'} planned` : 'Set your training days'}</b><p>{days.length ? days.map(day => day.slice(0, 3)).join(' · ') : 'Choose a weekly schedule that works for you.'}</p></div>
        </div>
        {!workoutLoading && !workoutError && days.length > 0 && <>
          <div className="hm-week" aria-label="This week’s planned and completed training days">{TRAINING_DAYS.map((day, index) => { const date = new Date(weekStart); date.setDate(date.getDate() + index); const completed = !!summary?.trainingDates.includes(formatLocalDate(date)); const planned = days.includes(day.value); return <div key={day.value} className={`hm-week-day${completed ? ' is-complete' : planned ? ' is-planned' : ''}`} aria-label={`${day.value}: ${completed ? 'workout completed' : planned ? 'planned' : 'not planned'}`}><i>{completed ? <Icon name="check" size={14}/> : planned ? <span/> : null}</i><span>{day.label.slice(0, 1)}</span></div>; })}</div>
          <p className="hm-meta">{workouts} {workouts === 1 ? 'day' : 'days'} with a completed workout this week</p>
          <p className="hm-legend-row"><span><i className="is-complete"/> Completed</span><span><i className="is-planned"/> Planned</span></p>
        </>}
        {workoutLoading && <p role="status" className="hm-state">Loading training activity…</p>}{workoutError && <p role="alert" className="hm-state">Training activity couldn’t be loaded. <button type="button" onClick={() => void refreshWorkouts()}>Retry</button></p>}
      </div>
    </section>

    <section className="hm-block" aria-labelledby="checkins-heading">
      <div className="hm-block-head"><h2 id="checkins-heading">Recent check-ins</h2><button type="button" className="hm-link" onClick={() => push('/progress?from=goals')}>View all <Icon name="chevron-right" size={14}/></button></div>
      <div className="hm-card" aria-busy={loading}>{loading ? <p role="status" className="hm-state">Loading your check-ins…</p> : error ? <p role="alert" className="hm-state">Your check-ins couldn’t be loaded. <button type="button" onClick={() => void refresh()}>Retry</button></p> : ordered.length ? <ol className="hm-timeline">{ordered.slice(0, 3).map((entry, index) => <li key={entry._id}><span className="hm-timeline-dot" aria-hidden="true"/><div><b>{index === 0 ? 'Latest check-in' : 'Weight check-in'}</b><small>{shortDate(entry.measuredAt ?? entry.date)}</small></div><strong>{entry.value} <small>{entry.unit}</small></strong></li>)}</ol> : <div className="hm-empty hm-empty-inline"><strong>Your first check-in starts here</strong><p>Log your weight to see your history over time.</p><button type="button" className="hm-btn hm-btn-soft hm-btn-sm" onClick={() => setWeightOpen(true)}>Log weight</button></div>}</div>
    </section>
    <p className="hm-footnote"><Icon name="lightbulb" size={17}/><span>Progress isn’t always linear. Your saved check-ins are here to help you see the bigger picture.</span></p>
    {weightOpen && <WeightModal profile={profile} onClose={() => setWeightOpen(false)} onSaved={message => { setWeightOpen(false); setWeightNotice(message); void refresh(); void refreshProfile(); }}/>}
  </div>;
}
