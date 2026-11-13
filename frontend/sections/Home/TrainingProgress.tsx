'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type ExerciseRecord, type WorkoutSessionRecord } from '../../lib/api';
import { exerciseHistory } from '../../lib/trainingProgress';
import { titleCase } from '../../lib/titleCase';
import { useCoachPlan } from '../../hooks/useCoachPlan';
import { muscleNames, resolveProgressMuscles } from '../../lib/progressMuscles';

type Picker = 'day' | 'exercise' | 'muscle' | 'muscleExercise';
type Option = { value: string; label: string; detail?: string };

function SelectionDialog({ title, options, onSelect, onClose }: { title: string; options: Option[]; onSelect: (value: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); }; }, []);
  return <dialog ref={ref} className="progress-picker" aria-labelledby="progress-picker-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="progress-picker-head"><div><span className="pq-progress-eyebrow">YOUR PROGRAM</span><h2 id="progress-picker-title">{title}</h2></div><button type="button" className="progress-picker-close" aria-label="Close" onClick={onClose}>×</button></div>
    <div className="progress-picker-options">{options.length ? options.map(option => <button type="button" key={option.value} onClick={() => onSelect(option.value)}><span><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</span><span aria-hidden="true">›</span></button>) : <p>No choices available in your current program.</p>}</div>
  </dialog>;
}

export default function TrainingProgress({ workouts, tab }: { workouts: WorkoutSessionRecord[]; tab: 'exercise' | 'muscle' }) {
  const [selected, setSelected] = useState('');
  const [muscle, setMuscle] = useState('');
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [catalog, setCatalog] = useState<Record<string, ExerciseRecord>>({});
  const { plan, error: planError, loading } = useCoachPlan();
  const days = useMemo(() => (plan?.days ?? []).filter(day => day.isWorkoutDay && day.exercises.length), [plan]);
  const day = days.find(item => item.index === dayIndex);
  const exerciseIds = useMemo(() => [...new Set(days.flatMap(item => item.exercises.map(exercise => exercise.exerciseId)))].filter(id => !id.startsWith('personal-')).sort(), [days]);
  const idsKey = JSON.stringify(exerciseIds);
  useEffect(() => {
    let active = true;
    const ids: string[] = JSON.parse(idsKey);
    async function load() {
      for (let index = 0; index < ids.length; index += 4) {
        const batch = await Promise.allSettled(ids.slice(index, index + 4).map(id => api.getExercise(id)));
        if (!active) return;
        setCatalog(current => {
          const next = { ...current };
          batch.forEach((result, offset) => { if (result.status === 'fulfilled') next[ids[index + offset]] = result.value; });
          return next;
        });
      }
    }
    void load();
    return () => { active = false; };
  }, [idsKey]);
  const programExercises = useMemo(() => {
    const map = new Map<string, { id: string; name: string; muscles: string }>();
    for (const item of days) for (const exercise of item.exercises) {
      const previous = map.get(exercise.exerciseId);
      map.set(exercise.exerciseId, { id: exercise.exerciseId, name: exercise.name, muscles: `${previous?.muscles ?? ''} ${exercise.targetMuscle ?? ''} ${exercise.group ?? ''}` });
    }
    return [...map.values()];
  }, [days]);
  const classified = programExercises.map(row => {
    const detail = catalog[row.id];
    const targets = detail?.targetMuscles?.length ? detail.targetMuscles : [row.muscles];
    return { ...row, ...resolveProgressMuscles(row.name, targets) };
  });
  const matching = classified.filter(row => muscle === 'Unclassified' ? !row.muscles.length : row.muscles.includes(muscle as typeof muscleNames[number]));
  const visible = tab === 'muscle' ? matching : (day?.exercises ?? []).map(exercise => ({ id: exercise.exerciseId, name: exercise.name }));
  const chosen = visible.find(row => row.id === selected);
  const history = chosen ? exerciseHistory(workouts, chosen.id) : [];
  const max = Math.max(...history.map(row => row.maxLoad), 1);
  const options: Option[] = picker === 'day' ? days.map(item => ({ value: String(item.index), label: `${titleCase(item.name)} – ${titleCase(item.title)}`, detail: `${item.exercises.length} ${item.exercises.length === 1 ? 'Exercise' : 'Exercises'}` })) : picker === 'muscle' ? [...muscleNames, 'Unclassified'].filter(name => classified.some(row => name === 'Unclassified' ? !row.muscles.length : row.muscles.includes(name as typeof muscleNames[number]))).map(name => ({ value: name, label: name })) : (picker === 'exercise' ? day?.exercises.map(item => ({ value: item.exerciseId, label: titleCase(item.name) })) : matching.map(item => ({ value: item.id, label: titleCase(item.name), detail: item.estimated ? 'Estimated muscle group' : undefined }))) ?? [];
  function choose(value: string) {
    if (picker === 'day') { setDayIndex(Number(value)); setSelected(''); setPicker(null); }
    else if (picker === 'muscle') { setMuscle(value); setSelected(''); setPicker(null); }
    else { setSelected(value); setPicker(null); }
  }
  return <section className="training-progress subsection" aria-label="Training progress">
    <div className="pq-progress-card-head"><div><span className="pq-progress-eyebrow">YOUR TRAINING</span><h3>{tab === 'exercise' ? 'Exercise Progress' : 'Muscle Progress'}</h3><p>Explore the work behind your progress.</p></div></div>
    {planError ? <p role="alert">Your current program could not be loaded. Please try again later.</p> : loading && !plan ? <p>Loading your program…</p> : !days.length ? <p>No workout days with exercises are available in your current program.</p> : <>
      {tab === 'exercise' ? <><span className="progress-picker-label">Workout Day</span><button type="button" className="progress-picker-trigger" onClick={() => setPicker('day')}><span>{day ? `${titleCase(day.name)} – ${titleCase(day.title)}` : 'Choose a Workout Day'}</span><span aria-hidden="true">⌄</span></button><span className="progress-picker-label">Exercise</span><button type="button" className="progress-picker-trigger" disabled={!day} onClick={() => setPicker('exercise')}><span>{chosen ? titleCase(chosen.name) : 'Choose an Exercise'}</span><span aria-hidden="true">⌄</span></button></> : <><span className="progress-picker-label">Muscle Group</span><button type="button" className="progress-picker-trigger" onClick={() => setPicker('muscle')}><span>{muscle || 'Choose a Muscle Group'}</span><span aria-hidden="true">⌄</span></button><span className="progress-picker-label">Exercise</span><button type="button" className="progress-picker-trigger" disabled={!matching.length} onClick={() => setPicker('muscleExercise')}><span>{chosen ? titleCase(chosen.name) : 'Choose an Exercise'}</span><span aria-hidden="true">⌄</span></button>{muscle && !matching.length && <small>No exercises for this muscle are assigned in your current program.</small>}</>}
      {chosen ? <>{history.length ? <>
        <p>Heaviest recorded working set per session · kg</p><div className="training-chart" role="img" aria-label={`${titleCase(chosen.name)}: ${history.map(point => `${new Date(point.date).toLocaleDateString()} ${point.maxLoad} kg`).join(', ')}`}><svg viewBox="0 0 320 120" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" points={history.map((point, index) => `${history.length === 1 ? 160 : 10 + index * 300 / (history.length - 1)},${110 - point.maxLoad / max * 95}`).join(' ')}/>{history.map((point, index) => <circle key={`${point.date}-${index}`} cx={history.length === 1 ? 160 : 10 + index * 300 / (history.length - 1)} cy={110 - point.maxLoad / max * 95} r="4" fill="currentColor"/>)}</svg></div>
        <p>Best load: <strong>{Math.max(...history.map(point => point.maxLoad))} kg</strong> · Most reps: <strong>{Math.max(...history.map(point => point.maxReps))}</strong></p><ul>{history.slice(-5).reverse().map((point, index) => <li key={`${point.date}-${index}`}>{new Date(point.date).toLocaleDateString()} · {point.sets.map(set => `${set.loadValue ?? Math.round(set.loadKg! * 100) / 100} ${set.loadUnit ?? 'kg'} × ${set.reps}`).join(', ')}</li>)}</ul>
      </> : <p>No weighted working sets logged for this exercise yet.</p>}</> : <p>Select an exercise to see its progress.</p>}
    </>}
    <small>Records count completed normal working sets only.</small>
    {tab === 'muscle' && <small>Muscle groups use catalog targets when available. Some matches are estimated from exercise names; exercises without enough information appear under Unclassified.</small>}
    {picker && <SelectionDialog key={picker} title={picker === 'day' ? 'Choose a Workout Day' : picker === 'muscle' ? 'Choose a Muscle Group' : 'Choose an Exercise'} options={options} onSelect={choose} onClose={() => setPicker(null)} />}
  </section>;
}
