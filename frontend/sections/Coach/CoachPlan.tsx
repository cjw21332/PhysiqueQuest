'use client';

import { useState } from 'react';
import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';
import { useCoachPlan } from '../../hooks/useCoachPlan';
import type { CoachExercise, WorkoutSessionRecord } from '../../lib/api';
import { expectedSets, plannedDayResults, setProgress } from '../../../shared/workouts';

export default function CoachPlan({ profile, onStart, onLibrary, onSelectedDayChange, selectedDate, workouts = [], progressLoading = false, progressError = '' }: { profile: Profile; onStart: (exercises: CoachExercise[], context?: { programVersion?: string; dayIndex?: number; scheduledDate?: string }) => void; onLibrary: () => void; onSelectedDayChange?: (dayIndex: number) => void; selectedDate?: string; workouts?: WorkoutSessionRecord[]; progressLoading?: boolean; progressError?: string }) {
  const { plan, loading, error, refresh } = useCoachPlan(profile as unknown as Record<string, unknown>);
  const [selectedDay, setSelectedDay] = useState(() => (new Date().getDay() + 6) % 7);
  const libraryLink = <button className="library-link-card" onClick={onLibrary}><div className="library-icon"><Icon name="book-open" size={18} /></div><div className="library-info"><div className="library-title">Exercise library</div><div className="library-subtitle">Demos and form guides</div></div><Icon name="arrow" size={16} /></button>;

  if (loading) return <div className="coach-plan"><header className="coach-plan-header"><h2 className="coach-title">AI Coach</h2></header><div className="profile-load-state" role="status"><h2>Building your plan…</h2></div>{libraryLink}</div>;
  if (error || !plan) return <div className="coach-plan"><header className="coach-plan-header"><h2 className="coach-title">AI Coach</h2></header><div className="profile-load-state" role="alert"><h2>Could not load your plan</h2><p>{error || 'Your profile is required to build a plan.'}</p><button onClick={() => void refresh()}>Try again</button></div>{libraryLink}</div>;

  const currentDay = plan.days[selectedDay] ?? plan.days[0];
  const todayIndex = (new Date().getDay() + 6) % 7;
  const isWorkoutDay = currentDay?.isWorkoutDay ?? false;
  const todayExercises = currentDay?.exercises ?? [];
  const plannedExercises = todayExercises.map(exercise => ({ exerciseId: exercise.exerciseId, sets: expectedSets(exercise.prescription || plan.sets) }));
  const results = selectedDate ? plannedDayResults(workouts, plan.programVersion, currentDay?.index ?? selectedDay, selectedDate, Intl.DateTimeFormat().resolvedOptions().timeZone) : [];
  const progress = setProgress(plannedExercises, results);
  const resumable = workouts.some(workout => workout.origin === 'planned' && workout.status === 'active' && workout.programVersion === plan.programVersion && workout.dayIndex === currentDay?.index);

  return <div className="coach-plan">
    <header className="coach-plan-header"><h2 className="coach-title">AI Coach</h2></header>
    <section className="week-section"><div className="week-info">{plan.weekLabel}</div><div className="week-days-grid">{plan.days.map((day, index) => <button type="button" key={day.index} aria-pressed={selectedDay === index} className={`day-button ${selectedDay === index ? 'selected' : ''} ${day.isWorkoutDay ? 'has-session' : ''}`} aria-label={`${day.name}, ${day.isWorkoutDay ? 'workout day' : 'recovery day'}`} onClick={() => { setSelectedDay(index); onSelectedDayChange?.(day.index); }}><span className="day-label">{day.name.slice(0, 1)}</span>{day.isWorkoutDay && <span className="day-dot" />}</button>)}</div></section>
    {isWorkoutDay ? <>
      <section className="workout-info-card"><div className="workout-label">{selectedDay === todayIndex ? 'Today' : currentDay?.name ?? 'Selected day'}</div><h3 className="workout-title">{currentDay.title}</h3><div className="workout-meta"><span className="meta-item">{plan.duration}</span><span className="meta-separator">·</span><span className="meta-item">{todayExercises.length} exercises</span>{currentDay.equipmentLabel && <><span className="meta-separator">·</span><span className="meta-item">{currentDay.equipmentLabel}</span></>}</div></section>
      {!plan.libraryReady ? <div className="rest-day-message"><h3>Exercises coming soon</h3><p>Your coach needs published exercises in the library before it can fill this session.</p></div> : <>
        {progressLoading ? <p role="status">Loading saved sets for this day…</p> : progressError ? <p role="alert">Remaining sets are unavailable until saved workouts can be loaded.</p> : <p role="status" aria-label={`Set progress for ${currentDay.name}`}>{progress.completed} of {progress.total} sets completed · {progress.skipped} skipped · {progress.remaining} remaining</p>}
        <section className="exercise-list-card" aria-label="Suggested exercises"><div className="exercise-list">{todayExercises.map((exercise, index) => {
          const itemProgress = setProgress([plannedExercises[index]], results);
          return <div key={exercise.exerciseId} className="exercise-item"><div className="exercise-number">{index + 1}</div><div className="exercise-details"><div className="exercise-name">{exercise.name}</div><div className="exercise-sets">{exercise.prescription || plan.sets}</div>{!progressLoading && !progressError && <small aria-label={`Remaining sets for ${exercise.name}`}>{itemProgress.remaining} {itemProgress.remaining === 1 ? 'set' : 'sets'} remaining{itemProgress.skipped ? ` · ${itemProgress.skipped} skipped` : ''}</small>}</div><div className={`tracking-badge ${exercise.tracking === 'AI tracked' ? 'ai-tracked' : 'manual'}`}>{exercise.tracking}</div></div>;
        })}</div></section>
        {currentDay.formTip && <div className="form-tip-card"><div className="tip-icon"><Icon name="lightbulb" size={18} /></div><div className="tip-content"><div className="tip-title">Form tip · {currentDay.formTip.exerciseName}</div><div className="tip-text">{currentDay.formTip.text}</div></div></div>}
        {!todayExercises.length && <p className="coach-plan-note">No matching exercises are available for this day. Check your preferences or browse the library.</p>}
        {!!todayExercises.length && currentDay.availabilityNote && <p className="coach-plan-note">{currentDay.availabilityNote}</p>}
      </>}
      {libraryLink}
      <div className="start-button-container"><button className="start-session-btn" disabled={!todayExercises.length || progressLoading || !!progressError} onClick={() => onStart(todayExercises.map(exercise => ({ ...exercise, prescription: exercise.prescription || plan.sets })), { programVersion: plan.programVersion, dayIndex: currentDay.index, scheduledDate: selectedDate })}><Icon name="play" size={18} />{resumable ? 'Resume session' : 'Start session'}</button></div>
    </> : <><div className="rest-day-message"><h3>{currentDay?.title ?? 'Rest day'}</h3><p>No workout scheduled for this day. Rest and recover!</p></div>{libraryLink}</>}
  </div>;
}

