'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type ExerciseRecord, type WorkoutSessionRecord } from '../../lib/api';
import { exerciseAnalytics } from '../../lib/trainingProgress';
import { titleCase } from '../../lib/titleCase';
import { useCoachPlan } from '../../hooks/useCoachPlan';
import { muscleNames, resolveProgressMuscles } from '../../lib/progressMuscles';

type Picker = 'day' | 'exercise' | 'muscle' | 'muscleExercise';
type Option = { value: string; label: string; detail?: string };

function ExerciseAnalytics({ workouts, id, name }: { workouts: WorkoutSessionRecord[]; id: string; name: string }) {
  const [metric, setMetric] = useState<'load' | 'reps' | 'volume'>('load');
  const [volumeView, setVolumeView] = useState<'total' | 'set'>('total');
  const volumeMenu = useRef<HTMLDetailsElement>(null);
  const history = exerciseAnalytics(workouts, id);
  if (!history.length) return <p>No completed working sets logged for this exercise yet.</p>;
  const latest = history[history.length - 1];
  const recordedSets = history.flatMap(row => row.sets).filter(set => (set.loadKg ?? 0) > 0);
  const recentUnits = [...recordedSets].reverse().map(set => set.loadUnit).filter((value): value is 'kg' | 'lbs' => value === 'kg' || value === 'lbs');
  const counts = { kg: recentUnits.filter(value => value === 'kg').length, lbs: recentUnits.filter(value => value === 'lbs').length };
  const unit = counts.kg === counts.lbs ? recentUnits[0] ?? 'kg' : counts.lbs > counts.kg ? 'lbs' : 'kg';
  const convert = (kg: number) => unit === 'lbs' ? kg / 0.45359237 : kg;
  const fmt = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
  const weighted = history.filter(row => row.maxLoad !== null);
  const useLoad = metric === 'load' && weighted.length > 0;
  const useVolume = metric === 'volume' && weighted.length > 0;
  const series: { date: string; value: number; set?: number }[] = useVolume
    ? volumeView === 'total'
      ? weighted.map(row => ({ date: row.date, value: convert(row.volumeKg!) }))
      : weighted.map(row => {
        const bestSet = [...row.sets].sort((a, b) => a.setIndex - b.setIndex).map((set, index) => ({ set, number: index + 1 })).filter(({ set }) => typeof set.loadKg === 'number' && set.loadKg > 0).reduce((best, candidate) => candidate.set.loadKg! * candidate.set.reps > best.set.loadKg! * best.set.reps ? candidate : best);
        return { date: row.date, set: bestSet.number, value: convert(bestSet.set.loadKg! * bestSet.set.reps) };
      })
    : (useLoad ? weighted : history).map(row => ({ date: row.date, value: useLoad ? convert(row.maxLoad!) : row.maxReps }));
  const best = weighted.length ? Math.max(...weighted.map(row => row.maxLoad!)) : null;
  const previous = series.at(-2), current = series.at(-1)!;
  const change = previous ? current.value - previous.value : null;
  // Use the recorded values as guide lines; round conversions to the same
  // precision shown on the chart so equivalent mixed-unit loads don't split.
  const round = (value: number) => Math.round(value * 10) / 10;
  const ticks = [...new Set((useLoad ? recordedSets.map(set => round(convert(set.loadKg!))) : series.map(point => point.value)))].sort((a, b) => a - b);
  const low = ticks[0], high = ticks[ticks.length - 1];
  const smallestGap = Math.min(...ticks.slice(1).map((value, index) => value - ticks[index]));
  const height = ticks.length > 1 ? Math.min(1600, Math.max(150, Math.ceil((high - low) / smallestGap * 20) + 24)) : 150;
  const y = (value: number) => high === low ? height / 2 : 12 + (high - value) / (high - low) * (height - 24);
  const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const measure = useVolume ? `${unit} × reps` : useLoad ? unit : 'reps';
  const chartTitle = useVolume ? volumeView === 'total' ? 'Total volume per workout' : 'Best set per workout' : useLoad ? 'Heaviest working set' : 'Most reps in a set';
  const pointLabel = (point: typeof current) => `${date(point.date)}${point.set ? `, set ${point.set}` : ''}`;
  const missingLoad = history.some(row => row.sets.some(set => typeof set.loadKg !== 'number' || set.loadKg <= 0));
  return <div className="training-analytics">
    <div className="training-analytics-heading"><div><span className="pq-progress-eyebrow">YOUR PERFORMANCE</span><h4>{titleCase(name)}</h4></div><span>{history.length} {history.length === 1 ? 'session' : 'sessions'}</span></div>
    <div className="training-analytics-stats"><div><small>{best === null ? 'Most reps in a set' : 'Best working load'}</small><strong>{best === null ? fmt(Math.max(...history.map(row => row.maxReps))) + ' reps' : fmt(convert(best)) + ' ' + unit}</strong></div><div><small>Latest session</small><strong>{date(latest.date)}</strong></div></div>
    {weighted.length > 0 && <div className="training-metric" role="group" aria-label="Chart measure"><button type="button" aria-pressed={useLoad} onClick={() => setMetric('load')}>Weight</button><button type="button" aria-pressed={metric === 'reps'} onClick={() => setMetric('reps')}>Reps</button><button type="button" aria-pressed={useVolume} onClick={() => setMetric('volume')}>Volume</button></div>}
    {useVolume && <div className="training-volume-filter"><span id="volume-filter-label">Show volume</span><details ref={volumeMenu} className="training-volume-menu" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); if (volumeMenu.current) { volumeMenu.current.open = false; volumeMenu.current.querySelector('summary')?.focus(); } } }}><summary aria-labelledby="volume-filter-label volume-filter-value"><span id="volume-filter-value">{volumeView === 'total' ? 'Total per workout' : 'Best set per workout'}</span><span className="training-volume-chevron" aria-hidden="true">⌄</span></summary><div className="training-volume-options" aria-label="Volume options">{([{ value: 'total', label: 'Total per workout' }, { value: 'set', label: 'Best set per workout' }] as const).map(option => <button type="button" key={option.value} aria-pressed={volumeView === option.value} onClick={() => { setVolumeView(option.value); if (volumeMenu.current) { volumeMenu.current.open = false; volumeMenu.current.querySelector('summary')?.focus(); } }}><span>{option.label}</span>{volumeView === option.value && <span aria-hidden="true">✓</span>}</button>)}</div></details></div>}
    <div className="training-trend"><div className="training-trend-heading"><strong>{chartTitle}</strong><span>{measure}</span></div>
      {useVolume && <p className="training-baseline">Weight × reps{missingLoad ? '. Sets without a recorded weight are excluded.' : '.'}</p>}
      {series.length < 2 ? <><strong>{fmt(current.value)} {measure}</strong><p className="training-baseline">Your first session is your baseline. Log more to see a trend.</p></> : <><p className="training-change">{change === 0 ? 'No change' : `${change! > 0 ? '+' : '−'}${fmt(Math.abs(change!))} ${measure}`} <span>from previous {useLoad ? 'weighted session' : 'session'}</span></p><div className="training-chart" role="img" aria-label={`${titleCase(name)}, ${useVolume ? chartTitle.toLowerCase() : useLoad ? 'heaviest working load by session' : 'most reps by session'}: ${series.map(point => `${pointLabel(point)}, ${fmt(point.value)} ${measure}`).join('; ')}. ${useLoad ? 'Recorded weights' : useVolume ? 'Volume values' : 'Repetitions'}: ${ticks.map(fmt).join(', ')} ${measure}`} tabIndex={height > 360 ? 0 : undefined}><svg viewBox={`0 0 320 ${height}`} style={{ height }} preserveAspectRatio="none" aria-hidden="true">{ticks.map(value => <g key={value}><line x1="55" x2="310" y1={y(value)} y2={y(value)} stroke="currentColor" opacity=".2" vectorEffect="non-scaling-stroke"/><text x="48" y={y(value)} textAnchor="end" dominantBaseline="middle" fill="currentColor" fontSize="10">{fmt(value)}</text></g>)}<polyline fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" points={series.map((point, index) => `${55 + index * 255 / (series.length - 1)},${y(useLoad ? round(point.value) : point.value)}`).join(' ')}/>{series.map((point, index) => <circle key={index} cx={55 + index * 255 / (series.length - 1)} cy={y(useLoad ? round(point.value) : point.value)} r="4" fill="currentColor"/>)}</svg></div><div className="training-chart-dates"><span>{pointLabel(series[0])}<br/>{fmt(series[0].value)} {measure}</span><span>{pointLabel(current)}<br/>{fmt(current.value)} {measure}</span></div></>}
    </div>
    <div className="training-history"><h5>Recent sessions</h5>{history.slice(-5).reverse().map((point, index) => <div className="training-history-row" key={`${point.date}-${index}`}><strong>{date(point.date)}</strong><span>{point.sets.map(set => `${set.loadValue != null ? `${fmt(set.loadValue)} ${set.loadUnit ?? 'kg'} × ` : set.loadKg != null && set.loadKg > 0 ? `${fmt(set.loadKg)} kg × ` : ''}${set.reps} reps`).join(' · ')}</span>{point.sets.some(set => set.barWeightKg !== undefined) && <small>Loads include an estimated bar.</small>}{point.volumeKg !== null && <small>Recorded-load volume: {fmt(convert(point.volumeKg))} {unit} × reps</small>}</div>)}</div>
  </div>;
}

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
  const { plan, error: planError, loading, refresh: refreshPlan } = useCoachPlan();
  const days = useMemo(() => {
    const groups = (plan?.days ?? []).map(day => ({ index: day.index, name: day.name, title: day.title, exercises: day.isWorkoutDay ? day.exercises.map(exercise => ({ exerciseId: exercise.exerciseId, name: exercise.name, targetMuscle: exercise.targetMuscle ?? '', group: exercise.group ?? '' })) : [] }));
    for (const workout of workouts) {
      if (workout.status !== 'completed') continue;
      const index = workout.dayIndex ?? (workout.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(workout.scheduledDate) ? (new Date(`${workout.scheduledDate}T12:00:00Z`).getUTCDay() + 6) % 7 : undefined);
      const group = groups.find(day => day.index === index);
      if (!group) continue;
      const completed = new Set((workout.sets ?? []).filter(set => set.status === 'completed' && (!set.setType || set.setType === 'normal') && set.reps > 0).map(set => set.exerciseId));
      for (const exercise of workout.exercises ?? []) {
        if (completed.has(exercise.exerciseId) && !group.exercises.some(item => item.exerciseId === exercise.exerciseId)) group.exercises.push({ exerciseId: exercise.exerciseId, name: exercise.name, targetMuscle: '', group: '' });
      }
    }
    return groups.filter(day => day.exercises.length);
  }, [plan, workouts]);
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
  const options: Option[] = picker === 'day' ? days.map(item => ({ value: String(item.index), label: `${titleCase(item.name)} – ${titleCase(item.title)}`, detail: `${item.exercises.length} ${item.exercises.length === 1 ? 'Exercise' : 'Exercises'}` })) : picker === 'muscle' ? [...([...muscleNames].sort((a, b) => a.localeCompare(b)) as string[]), 'Unclassified'].filter(name => classified.some(row => name === 'Unclassified' ? !row.muscles.length : row.muscles.includes(name as typeof muscleNames[number]))).map(name => ({ value: name, label: name })) : (picker === 'exercise' ? day?.exercises.map(item => ({ value: item.exerciseId, label: titleCase(item.name) })) : matching.map(item => ({ value: item.id, label: titleCase(item.name), detail: item.estimated ? 'Estimated muscle group' : undefined }))) ?? [];
  function choose(value: string) {
    if (picker === 'day') { setDayIndex(Number(value)); setSelected(''); setPicker(null); }
    else if (picker === 'muscle') { setMuscle(value); setSelected(''); setPicker(null); }
    else { setSelected(value); setPicker(null); }
  }
  return <section className="training-progress subsection" aria-label="Training progress">
    <div className="pq-progress-card-head"><div><span className="pq-progress-eyebrow">YOUR TRAINING</span><h3>{tab === 'exercise' ? 'Exercise Progress' : 'Muscle Progress'}</h3><p>Explore the work behind your progress.</p></div></div>
    {planError && <p role="alert">Your current program could not be loaded. Showing available workout history. <button type="button" className="training-retry" onClick={() => void refreshPlan()}>Try again</button></p>}
    {loading && !plan && !days.length ? <p>Loading your program…</p> : !days.length ? <p>No exercises are available in your program or workout history yet.</p> : <>
      {tab === 'exercise' ? <><span className="progress-picker-label">Workout Day</span><button type="button" className="progress-picker-trigger" onClick={() => setPicker('day')}><span>{day ? `${titleCase(day.name)} – ${titleCase(day.title)}` : 'Choose a Workout Day'}</span><span aria-hidden="true">⌄</span></button><span className="progress-picker-label">Exercise</span><button type="button" className="progress-picker-trigger" disabled={!day} onClick={() => setPicker('exercise')}><span>{chosen ? titleCase(chosen.name) : 'Choose an Exercise'}</span><span aria-hidden="true">⌄</span></button></> : <><span className="progress-picker-label">Muscle Group</span><button type="button" className="progress-picker-trigger" onClick={() => setPicker('muscle')}><span>{muscle || 'Choose a Muscle Group'}</span><span aria-hidden="true">⌄</span></button><span className="progress-picker-label">Exercise</span><button type="button" className="progress-picker-trigger" disabled={!matching.length} onClick={() => setPicker('muscleExercise')}><span>{chosen ? titleCase(chosen.name) : 'Choose an Exercise'}</span><span aria-hidden="true">⌄</span></button>{muscle && !matching.length && <small>No exercises for this muscle are assigned in your current program.</small>}</>}
      {chosen ? <ExerciseAnalytics key={chosen.id} workouts={workouts} id={chosen.id} name={chosen.name} /> : <p>Select an exercise to see its progress.</p>}
    </>}
    <small>Records count completed normal working sets only.</small>
    {tab === 'muscle' && <small>Muscle groups use catalog targets when available. Some matches are estimated from exercise names; exercises without enough information appear under Unclassified.</small>}
    {picker && <SelectionDialog key={picker} title={picker === 'day' ? 'Choose a Workout Day' : picker === 'muscle' ? 'Choose a Muscle Group' : 'Choose an Exercise'} options={options} onSelect={choose} onClose={() => setPicker(null)} />}
  </section>;
}
