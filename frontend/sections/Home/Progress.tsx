'use client';

import { useActivity } from '../../hooks/useActivity';
import { Icon } from './icons';

export default function Progress({ onBack }: { onBack: () => void }) {
  const { activity, loading, error } = useActivity();
  return <>
    <header className="section-page-head"><div className="section-back-title"><button className="coach-back" onClick={onBack} aria-label="Back to Home"><Icon name="arrow" size={24}/></button><h2>Progress</h2></div></header>
    {loading ? <div className="profile-load-state" role="status"><h2>Loading progress…</h2></div> : error ? <div className="profile-load-state" role="alert"><h2>Could not load progress</h2><p>{error}</p></div> : <>
      <section className="progress-overview"><div className="metric-value"><b>{activity.dayStreak} day streak</b><span><Icon name="trend" size={13}/> Activity is saved from completed actions</span></div><p className="profile-empty-state">No progress measurements yet. Log real measurements or complete a workout to build this view.</p></section>
      <section className="subsection records"><h3>Personal records</h3><p className="profile-empty-state">No personal records saved yet.</p></section>
      <section className="subsection accuracy"><div className="section-head"><h3>Form accuracy</h3><small>Unavailable</small></div><p className="profile-empty-state">Form scoring is unavailable until pose tracking is connected.</p></section>
      <section className="subsection recent-sessions"><h3>Recent sessions</h3><p className="profile-empty-state">No completed sessions saved yet.</p></section>
    </>}
  </>;
}
