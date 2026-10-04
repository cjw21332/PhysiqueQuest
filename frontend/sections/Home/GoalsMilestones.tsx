'use client';

import type { Profile } from './types';
import { Icon } from './icons';
import { useProgress } from '../../hooks/useProgress';

export default function GoalsMilestones({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const { entries, loading, error, refresh } = useProgress('weight');
  const latest = entries[0];
  const target = Number(profile.targetWeight);
  const current = latest?.value ?? (Number(profile.weight) || null);
  const unit = latest?.unit ?? profile.weightUnit ?? 'kg';
  const progress = current && Number.isFinite(target) && target > 0 ? Math.min(100, Math.round(current / target * 100)) : null;
  return <>
    <header className="section-page-head"><div className="section-back-title"><button className="coach-back" onClick={onBack} aria-label="Back to Home"><Icon name="arrow" size={24}/></button><h2>Goals</h2></div></header>
    <section className="goal-hero"><small>Primary goal</small><div className="goal-hero-title"><h2>{profile.goal || 'No goal set'}</h2>{progress !== null && <b>{progress}%</b>}</div>
      {progress !== null && <div className="goal-progress"><i style={{ width: `${progress}%` }}/></div>}
      <div className="goal-weights"><b>{current ? `${current} ${unit} current` : 'No weight measurement saved'}</b><span>{target > 0 ? `${target} ${profile.weightUnit || unit} target` : 'No target weight set'}</span></div>
      <small className="goal-date">{profile.targetDate ? `Target date · ${new Date(`${profile.targetDate}T12:00:00`).toLocaleDateString()}` : 'No target date set'}</small>
    </section>
    <section className="subsection"><div className="section-head"><h3>Weight milestones</h3></div>
      {error && <div role="alert" className="scan-warning">{error}<button onClick={() => void refresh()}>Retry</button></div>}
      {loading ? <p role="status">Loading saved measurements…</p> : entries.length ? <div className="milestone-list">{entries.map(entry => <div className="milestone done" key={entry._id}><span className="milestone-dot"><Icon name="check" size={12}/></span><div><b>{entry.value} {entry.unit}</b><small>{entry.measuredAt ? new Date(entry.measuredAt).toLocaleDateString() : 'Date unavailable'}</small></div></div>)}</div> : <p>No weight milestones yet. Save a measurement in Progress to start your history.</p>}
    </section>
    <section className="subsection secondary-goals"><h3>Other tracked goals</h3><p>Workout history and form analysis appear here when saved workout and analysis data is available.</p></section>
  </>;
}
