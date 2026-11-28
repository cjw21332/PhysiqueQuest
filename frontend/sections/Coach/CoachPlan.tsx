'use client';
import { titleCase } from '../../lib/titleCase';

import { useState } from 'react';
import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';
import { useCoachPlan } from '../../hooks/useCoachPlan';
import type { CoachExercise } from '../../lib/api';
import { formatLoad, formatRest, suggestFor } from '../../lib/programSuggest';
import ProgramDayEditor from './ProgramDayEditor';
import { useTrainingContext } from '../../hooks/useTrainingContext';

const hasLoad = (prescription = '') => /(?:@|·)\s*(?:[A-Za-z][A-Za-z .-]{0,30}?\s*\+\s*)?\d+(?:\.\d+)?\s*(?:kg|lbs?)\b/i.test(prescription);

// Programs and the exercise library are reached through the Coach tabs above this view.
export default function CoachPlan({ profile, onStart }: { profile: Profile; onStart: (exercises: CoachExercise[], title?: string) => void }) {
  const { plan, loading, error, refresh } = useCoachPlan(profile as unknown as Record<string, unknown>);
  const ctx = useTrainingContext(profile);
  const [selectedDay, setSelectedDay] = useState(() => (new Date().getDay() + 6) % 7);
  const [editing, setEditing] = useState(false);

  if (loading) return <div className="cq-today"><div className="profile-load-state" role="status" aria-label="Loading plan" aria-busy="true"><div className="section-placeholder" aria-hidden="true" /></div></div>;
  if (error || !plan) return <div className="cq-today"><div className="profile-load-state" role="alert"><h2>Could not load your plan</h2><p>{error || 'Your profile is required to build a plan.'}</p><button type="button" onClick={() => void refresh()}>Try again</button></div></div>;

  const currentDay = plan.days[selectedDay] ?? plan.days[0];
  const todayIndex = (new Date().getDay() + 6) % 7;
  const monday = new Date(); monday.setDate(monday.getDate() - todayIndex);
  const isWorkoutDay = currentDay?.isWorkoutDay ?? false;
  const rows = (currentDay?.exercises ?? []).map(exercise => {
    const [, sets, reps] = exercise.prescription?.match(/^(\d+)\s*[×x]\s*(\d+(?:-\d+)?(?:\s*s\b)?)/i) ?? [];
    const hint = suggestFor(exercise, ctx, {}, { sets: sets ? Number(sets) : undefined, reps });
    const prescription = hasLoad(exercise.prescription) || hint.weight === undefined ? exercise.prescription : `${exercise.prescription || plan.sets} @ ${hint.weight} ${hint.unit}`;
    return { exercise, hint, session: { ...exercise, prescription, restBetweenSets: exercise.restBetweenSets ?? hint.restSets, restAfterExercise: exercise.restAfterExercise ?? hint.restNext } as CoachExercise };
  });
  const totalSets = rows.reduce((sum, row) => sum + row.hint.sets, 0);

  return <div className="cq-today">
    <section className="cq-week" aria-label="This week">
      <div className="cq-week-head">{plan.weekLabel}</div>
      <div className="cq-week-grid">{plan.days.map((day, index) => {
        const date = new Date(monday); date.setDate(monday.getDate() + index);
        return <button type="button" key={day.index} disabled={editing} aria-pressed={selectedDay === index} className={`cq-day day-button ${selectedDay === index ? 'selected' : ''} ${day.isWorkoutDay ? 'has-session' : ''} ${index === todayIndex ? 'is-today' : ''}`} aria-label={`${day.name}, ${day.isWorkoutDay ? 'workout day' : 'recovery day'}`} onClick={() => setSelectedDay(index)}>
          <span className="day-label">{day.name.slice(0, 1)}</span><b>{date.getDate()}</b><span className="day-dot" aria-hidden="true" />
        </button>;
      })}</div>
    </section>

    {editing && currentDay && plan.programVersion ? <ProgramDayEditor key={currentDay.index} day={currentDay} version={plan.programVersion} onCancel={() => setEditing(false)} onSaved={async () => { await refresh(); setEditing(false); }}/> : <>
      {isWorkoutDay ? <>
        <section className="cq-hero">
          <div className="cq-hero-top">
            <span className="cq-hero-label">{selectedDay === todayIndex ? 'Today' : currentDay?.name ?? 'Selected day'}</span>
            <button type="button" className="cq-hero-edit" onClick={() => setEditing(true)} disabled={!plan.programVersion}><Icon name="edit" size={14}/>Edit day</button>
          </div>
          <h3 className="cq-hero-title">{titleCase(currentDay.title)}</h3>
          <div className="cq-hero-meta">
            <span><Icon name="clock" size={14}/>{plan.duration}</span>
            <span><Icon name="dumbbell" size={14}/>{rows.length} exercises</span>
            {totalSets > 0 && <span><Icon name="target" size={14}/>{totalSets} sets</span>}
          </div>
          {currentDay.equipmentLabel && <p className="cq-hero-equipment">{currentDay.equipmentLabel}</p>}
          <button type="button" className="cq-start primary" disabled={!rows.length || !plan.libraryReady} onClick={() => onStart(rows.map(row => row.session), currentDay.title)}><Icon name="play" size={18} />Start session</button>
        </section>
        {!plan.libraryReady ? <div><h3>Exercises coming soon</h3><p>Your coach needs published exercises in the library before it can fill this session.</p></div> : <>
          <section aria-label="Suggested exercises">
            <ol className="cq-exercises cq-compact">{rows.map(({ exercise, hint }, index) => <li key={exercise.exerciseId ?? `${exercise.name}-${index}`} className="cq-exercise exercise-item">
              <span className="cq-ex-num" aria-hidden="true">{index + 1}</span>
              <div className="cq-ex-body">
                <strong>{titleCase(exercise.name)}</strong>
                <small>{exercise.prescription || plan.sets}{!hasLoad(exercise.prescription) && hint.weight !== undefined && <> · <span className="cq-suggested">{formatLoad(hint)}</span></>}</small>
                <small className="cq-ex-rest"><Icon name="clock" size={12}/>Rest {formatRest(exercise.restBetweenSets ?? hint.restSets)} · {formatRest(exercise.restAfterExercise ?? hint.restNext)} before next</small>
                {exercise.feedbackTip && <small className="cq-ex-feedback" role="note"><Icon name="coach-wand" size={12}/>{exercise.feedbackTip}</small>}
              </div>
              {/* Manual is the default, so only camera-tracked exercises get a badge. */}
              {exercise.tracking === 'AI tracked' && <span className="cq-badge">AI tracked</span>}
            </li>)}</ol>
          </section>
          {rows.some(row => row.hint.weight !== undefined) && <p className="cq-fineprint">Suggested weights are starting points from your profile{ctx.records.length ? ' and logged sets' : ''}. Adjust to how each set feels.</p>}
          {currentDay.formTip && <div className="form-tip-card cq-note"><div className="tip-icon"><Icon name="lightbulb" size={18} /></div><div className="tip-content"><div className="tip-title">Form tip · {currentDay.formTip.exerciseName}</div><div className="tip-text">{currentDay.formTip.text}</div></div></div>}
          {!rows.length && <p className="coach-plan-note">No matching exercises are available for this day. Check your preferences or browse the library.</p>}
          {!!rows.length && currentDay.availabilityNote && <p className="coach-plan-note">{currentDay.availabilityNote}</p>}
          {plan.ageNote && <p className="coach-plan-note" role="note">{plan.ageNote}</p>}
          {plan.intensityNote && <p className="coach-plan-note" role="note">{plan.intensityNote}</p>}
        </>}
      </> : <section className="cq-rest">
        <span className="cq-rest-icon" aria-hidden="true"><Icon name="sun" size={22}/></span>
        <h3>{currentDay?.title ?? 'Rest day'}</h3>
        <p>No workout scheduled for this day. Recovery is part of the plan; the Programs tab has sessions if you want to train.</p>
        <div className="cq-rest-actions"><button type="button" className="secondary" onClick={() => setEditing(true)} disabled={!plan.programVersion}>Edit day</button></div>
      </section>}
    </>}
  </div>;
}
