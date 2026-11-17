'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile } from './types';
import { Icon } from './icons';
import { useProgress } from '../../hooks/useProgress';
import { useWorkoutSummary } from '../../hooks/useWorkoutSummary';
import { normalizeTrainingDays, TRAINING_DAYS } from '../../lib/trainingDays';
import { formatLocalDate } from '../../lib/localDate.mjs';
import WeightModal from '../../components/WeightModal';
import './goals.css';

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

  return <div className="home-ref-subview pq-goals">
    <header className="section-page-head pq-goals-header">
      <button type="button" className="coach-back" onClick={() => push('/home')} aria-label="Back to Home"><Icon name="arrow" size={20}/></button>
      <h1>Goals</h1>
      <button type="button" className="pq-goals-edit" onClick={() => push('/me/goals')}><Icon name="edit" size={15}/> Edit</button>
    </header>

    <div className="pq-goals-intro"><div><span className="pq-goals-eyebrow">YOUR JOURNEY</span><h2>Progress, on your terms.</h2><p>A clearer picture of where you’re headed.</p></div><span className="pq-goals-intro-mark"><Icon name="target" size={27}/></span></div>

    <section className="pq-goals-hero" aria-labelledby="goal-primary">
      <div className="pq-goals-hero-top"><span className="pq-goals-goal-label"><Icon name="target" size={16}/> PRIMARY GOAL</span><span className="pq-goals-goal-status">YOUR FOCUS</span></div>
      <h2 id="goal-primary">{profile.goal || 'Choose your goal'}</h2>
      <p>{profile.goal ? 'A little progress adds up. Keep showing up for yourself.' : 'Set a goal to give your training a direction.'}</p>
      <div className="pq-goals-metrics"><div><small><Icon name="scale" size={15}/> CURRENT</small><strong>{hasCurrent ? <>{current.toLocaleString()} <span>{unit}</span></> : 'Not set'}</strong><em>Profile weight</em></div><div><small><Icon name="target" size={15}/> TARGET</small><strong>{hasTarget ? <>{target.toLocaleString()} <span>{unit}</span></> : 'Not set'}</strong><em>Your goal</em></div></div>
      <div className="pq-goals-target"><Icon name={reached ? 'check-circle' : 'target'} size={17}/><span>{difference === null ? 'Add a current and target weight to compare.' : reached ? 'You’re at your target weight.' : `${Number(difference.toFixed(1))} ${unit} ${current < target ? 'below' : 'above'} your target`}</span></div>
      <div className="pq-goals-hero-actions"><button type="button" className="pq-goals-primary" onClick={() => setWeightOpen(true)}><Icon name="scale" size={17}/> Update weight</button><button type="button" className="pq-goals-text-button" onClick={() => push('/me/goals')}>{profile.goal ? 'Edit goal' : 'Set a goal'} <Icon name="chevron-right" size={15}/></button></div>
      {weightNotice && <p className="pq-goals-notice" role="status">{weightNotice}</p>}
    </section>

    <section className="pq-goals-date" aria-label="Target date"><span className="pq-goals-icon"><Icon name="calendar" size={19}/></span><div><small>TARGET DATE</small><strong>{validDate ? shortDate(validDate.toISOString()) : 'No date set'}</strong><p>{pastTarget ? 'This date has passed. Review it whenever you’re ready.' : validDate ? 'Your personal target, not a deadline.' : 'A date is optional. Set one in your goal settings.'}</p></div><button type="button" onClick={() => push('/me/goals')} aria-label="Edit target date"><Icon name="chevron-right" size={18}/></button></section>

    <section className="pq-goals-section" aria-labelledby="training-heading"><div className="pq-goals-section-head"><div><span className="pq-goals-eyebrow">BUILD CONSISTENCY</span><h2 id="training-heading">This week’s training</h2></div><button type="button" onClick={() => push('/me/training')}>Schedule <span aria-hidden="true">→</span></button></div>
      <div className="pq-goals-card pq-goals-training"><div className="pq-goals-training-top"><span className="pq-goals-icon"><Icon name="dumbbell" size={20}/></span><div><strong>{days.length ? `${days.length} ${days.length === 1 ? 'day' : 'days'} planned` : 'Set your training days'}</strong><p>{days.length ? days.map(day => day.slice(0, 3)).join(' · ') : 'Choose a weekly schedule that works for you.'}</p></div><span className="pq-goals-training-count">{workoutLoading ? '…' : workoutError ? '—' : workouts}<small>{days.length ? ` / ${days.length}` : ''}</small></span></div>
        {!workoutLoading && !workoutError && days.length > 0 && <><div className="pq-goals-track" role="progressbar" aria-label="Weekly training days completed" aria-valuemin={0} aria-valuemax={days.length} aria-valuenow={Math.min(workouts, days.length)}><span style={{ width: `${percent}%` }}/></div><p className="pq-goals-caption">{workouts} {workouts === 1 ? 'day' : 'days'} with a completed workout this week</p><div className="pq-goals-week" aria-label="This week’s planned and completed training days">{TRAINING_DAYS.map((day, index) => { const date = new Date(weekStart); date.setDate(date.getDate() + index); const completed = !!summary?.trainingDates.includes(formatLocalDate(date)); const planned = days.includes(day.value); return <div key={day.value} className={`pq-goals-week-day${completed ? ' is-complete' : planned ? ' is-planned' : ''}`} aria-label={`${day.value}: ${completed ? 'workout completed' : planned ? 'planned' : 'not planned'}`}><span>{day.label.slice(0, 1)}</span><i>{completed ? <Icon name="check" size={13}/> : planned ? <span/> : '—'}</i></div>; })}</div><div className="pq-goals-week-legend"><span><i className="is-complete"/> Completed</span><span><i className="is-planned"/> Planned</span></div></>}
        {workoutLoading && <p role="status">Loading training activity…</p>}{workoutError && <p role="alert">Training activity couldn’t be loaded. <button type="button" onClick={() => void refreshWorkouts()}>Retry</button></p>}
      </div>
    </section>

    <section className="pq-goals-section" aria-labelledby="checkins-heading"><div className="pq-goals-section-head"><div><span className="pq-goals-eyebrow">YOUR PROGRESS</span><h2 id="checkins-heading">Recent check-ins</h2></div><button type="button" onClick={() => push('/progress')}>View all <span aria-hidden="true">→</span></button></div>
      <div className="pq-goals-card pq-goals-checkins" aria-busy={loading}>{loading ? <p role="status">Loading your check-ins…</p> : error ? <p role="alert">Your check-ins couldn’t be loaded. <button type="button" onClick={() => void refresh()}>Retry</button></p> : ordered.length ? <ul>{ordered.slice(0, 3).map((entry, index) => <li key={entry._id}><span className="pq-goals-check-icon"><Icon name="scale" size={16}/></span><div><strong>{index === 0 ? 'Latest check-in' : 'Weight check-in'}</strong><small>{shortDate(entry.measuredAt ?? entry.date)}</small></div><b>{entry.value} <small>{entry.unit}</small></b></li>)}</ul> : <div className="pq-goals-empty"><strong>Your first check-in starts here</strong><p>Log your weight to see your history over time.</p><button type="button" onClick={() => setWeightOpen(true)}>Log weight <Icon name="chevron-right" size={15}/></button></div>}</div>
    </section>
    <div className="pq-goals-footnote"><Icon name="lightbulb" size={17}/><p>Progress isn’t always linear. Your saved check-ins are here to help you see the bigger picture.</p></div>
    {weightOpen && <WeightModal profile={profile} onClose={() => setWeightOpen(false)} onSaved={message => { setWeightOpen(false); setWeightNotice(message); void refresh(); void refreshProfile(); }}/>}
  </div>;
}
