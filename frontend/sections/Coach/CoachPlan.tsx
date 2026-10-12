'use client';

import { useState } from 'react';
import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';
import { useCoachPlan } from '../../hooks/useCoachPlan';

export default function CoachPlan({ profile, onStart, onLibrary }: { profile: Profile; onStart: () => void; onLibrary: () => void }) {
  const { plan, loading, error, refresh } = useCoachPlan();
  const [selectedDay, setSelectedDay] = useState(0);

  if (loading) return <div className="coach-plan"><header className="coach-plan-header"><h2 className="coach-title">AI Coach</h2></header><div className="profile-load-state" role="status"><h2>Building your plan…</h2></div></div>;
  if (error || !plan) return <div className="coach-plan"><header className="coach-plan-header"><h2 className="coach-title">AI Coach</h2></header><div className="profile-load-state" role="alert"><h2>Could not load your plan</h2><p>{error || 'Your profile is required to build a plan.'}</p><button onClick={() => void refresh()}>Try again</button></div></div>;

  const currentDay = plan.days[selectedDay] ?? plan.days[0];
  const isWorkoutDay = currentDay?.isWorkoutDay ?? false;
  const todayExercises = currentDay?.exercises ?? [];

  return <div className="coach-plan">
    <header className="coach-plan-header"><h2 className="coach-title">AI Coach</h2></header>
    <section className="week-section"><div className="week-info">{plan.weekLabel}</div><div className="week-days-grid">{plan.days.map((day, index) => <button key={index} className={`day-button ${selectedDay === index ? 'selected' : ''} ${day.isWorkoutDay ? 'has-session' : ''}`} onClick={() => setSelectedDay(index)}><span className="day-label">{day.label}</span>{day.isWorkoutDay && <div className="day-dot" />}</button>)}</div></section>
    {isWorkoutDay ? <>
      <section className="workout-info-card"><div className="workout-label">Today</div><h3 className="workout-title">{currentDay.title}</h3><div className="workout-meta"><span className="meta-item">{plan.duration || profile.duration || '45 min'}</span><span className="meta-separator">·</span><span className="meta-item">{todayExercises.length} exercises</span><span className="meta-separator">·</span><span className="meta-item">{profile.equipment?.[0] || 'Dumbbells'}</span></div></section>
      {!plan.libraryReady ? <div className="rest-day-message"><h3>Exercises coming soon</h3><p>Your coach needs published exercises in the library before it can fill this session.</p></div> : <>
        <section className="exercise-list-card"><div className="exercise-list-header"><h4>Exercises</h4><span className="exercise-count">{todayExercises.length}</span></div><div className="exercise-list">{todayExercises.map((exercise, index) => <div key={exercise.exerciseId} className="exercise-item"><div className="exercise-number">{index + 1}</div><div className="exercise-details"><div className="exercise-name">{exercise.name}</div><div className="exercise-sets">{plan.sets}</div></div><div className={`tracking-badge ${exercise.tracking === 'AI tracked' ? 'ai-tracked' : 'manual'}`}>{exercise.tracking}</div></div>)}</div></section>
        {todayExercises[0] && <div className="form-tip-card"><div className="tip-icon"><Icon name="coach" size={20} /></div><div className="tip-content"><div className="tip-title">Form tip</div><div className="tip-exercise">{todayExercises[0].name}</div><div className="tip-text">Move with control and keep your core braced through every rep of {todayExercises[0].name}.</div></div></div>}
      </>}
      <button className="library-link-card" onClick={onLibrary}><div className="library-icon"><Icon name="medal" size={22} /></div><div className="library-info"><div className="library-title">Exercise library</div><div className="library-subtitle">Demos and form guides</div></div><Icon name="arrow" size={18} /></button>
      <div className="start-button-container"><button className="start-session-btn" onClick={onStart}><Icon name="play" size={18} />Start session</button></div>
    </> : <div className="rest-day-message"><h3>{currentDay?.title ?? 'Rest day'}</h3><p>No workout scheduled for this day. Rest and recover!</p></div>}
  </div>;
}
