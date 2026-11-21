'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type ExerciseRecord } from '../../lib/api';
import { muscleNames, resolveProgressMuscles } from '../../lib/progressMuscles';
import { titleCase } from '../../lib/titleCase';
import { useCoachPlan } from '../../hooks/useCoachPlan';
import { Icon } from '../Home/icons';

type Exercise = { id: string; name: string };
export default function StrengthFilters({ exercises, selected, onSelect, loading, error }: { exercises: Exercise[]; selected: string; onSelect: (id: string) => void; loading: boolean; error: boolean }) {
  const [muscle, setMuscle] = useState('All muscles');
  const [picker, setPicker] = useState<'muscle' | 'exercise' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (picker && element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, [picker]);
  const closePicker = () => { setPicker(null); requestAnimationFrame(() => trigger.current?.focus()); };
  const [catalog, setCatalog] = useState<Record<string, ExerciseRecord>>({});
  const { plan } = useCoachPlan();
  // Keep catalogue lookup bounded as the leaderboard grows; the remaining
  // exercises still use program metadata or name-based estimates.
  const idsKey = JSON.stringify([...new Set(exercises.map(item => item.id).filter(id => !id.startsWith('personal-')))].sort().slice(0, 40));
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
  const { options, groups } = useMemo(() => {
    const metadata = new Map<string, string[]>();
    for (const day of plan?.days ?? []) for (const exercise of day.exercises) {
      metadata.set(exercise.exerciseId, [...(metadata.get(exercise.exerciseId) ?? []), exercise.targetMuscle ?? '', exercise.group ?? '']);
    }
    const classified = exercises.map(exercise => {
      const targets = catalog[exercise.id]?.targetMuscles;
      const match = resolveProgressMuscles(exercise.name, targets?.length ? targets : metadata.get(exercise.id) ?? []);
      return { ...exercise, muscles: match.muscles.length ? match.muscles : ['Unclassified'] };
    });
    const groups: string[] = [...muscleNames].sort((a, b) => a.localeCompare(b)).filter(group => classified.some(item => item.muscles.includes(group)));
    if (classified.some(item => item.muscles.includes('Unclassified'))) groups.push('Unclassified');
    const options = classified.filter(item => muscle === 'All muscles' || item.muscles.includes(muscle)).sort((a, b) => a.name.localeCompare(b.name));
    return { options, groups };
  }, [exercises, plan, catalog, muscle]);
  const current = exercises.find(item => item.id === selected);
  const currentFiltered = current && !options.some(item => item.id === current.id);
  return <section className="strength-filter-card" aria-label="Find an exercise">
    <div className="strength-filter-heading"><div><h3>Choose an exercise</h3><p>Filter by muscle group and select an exercise.</p></div><span>{loading && !exercises.length ? 'Loading…' : `${exercises.length} available`}</span></div>
    <div className="strength-filter-fields">
      <div className="strength-picker-field"><span id="muscle-picker-label">Muscle group</span><button type="button" aria-labelledby="muscle-picker-label muscle-picker-value" aria-haspopup="dialog" onClick={event => { trigger.current = event.currentTarget; setPicker('muscle'); }}><span id="muscle-picker-value">{muscle}</span><Icon name="chevron-down" size={18}/></button></div>
      <div className="strength-picker-field"><span id="exercise-picker-label">Exercise</span><button type="button" aria-labelledby="exercise-picker-label exercise-picker-value" aria-haspopup="dialog" disabled={!exercises.length} onClick={event => { trigger.current = event.currentTarget; setPicker('exercise'); }}><span id="exercise-picker-value">{current ? titleCase(current.name) : 'Choose an exercise'}</span><Icon name="chevron-down" size={18}/></button></div>
    </div>
    {current && <p className="strength-filter-current">Showing rankings for <strong>{titleCase(current.name)}</strong></p>}
    <p className="strength-filter-hint" role="status">{loading && !exercises.length ? 'Loading exercises…' : error && !exercises.length ? 'Exercises are unavailable. Try loading the rankings again.' : !exercises.length ? 'No ranked exercises are available yet.' : options.length ? `${options.length} ${options.length === 1 ? 'exercise matches' : 'exercises match'} your filters.` : 'No exercises match. Try another muscle group.'}</p>
    <p className="strength-filter-note">Muscle groups may be estimated from exercise names.</p>
    {picker && <dialog ref={dialog} className="strength-picker-dialog" aria-labelledby="strength-picker-title" onCancel={event => { event.preventDefault(); closePicker(); }} onClick={event => { if (event.target === event.currentTarget) closePicker(); }}><div className="strength-picker-header"><div><span>FILTER RANKINGS</span><h3 id="strength-picker-title">{picker === 'muscle' ? 'Muscle group' : 'Choose an exercise'}</h3></div><button type="button" className="strength-picker-close" aria-label="Close filter" onClick={closePicker}><Icon name="close" size={20}/></button></div><p className="strength-picker-description">{picker === 'muscle' ? 'Choose a muscle group to narrow the list.' : `Exercises for ${muscle.toLowerCase()}.`}</p><div className="strength-picker-options" role="group" aria-label={picker === 'muscle' ? 'Muscle groups' : 'Exercises'}>{picker === 'muscle' ? ['All muscles', ...groups].map(group => <button type="button" key={group} aria-pressed={muscle === group} onClick={() => { setMuscle(group); closePicker(); }}><span>{group}</span>{muscle === group && <Icon name="check" size={18}/>}</button>) : <>{currentFiltered && <button type="button" aria-pressed="true" onClick={closePicker}><span>{titleCase(current.name)} (current)</span><Icon name="check" size={18}/></button>}{options.map(item => <button type="button" key={item.id} aria-pressed={item.id === selected} onClick={() => { onSelect(item.id); closePicker(); }}><span>{titleCase(item.name)}</span>{item.id === selected && <Icon name="check" size={18}/>}</button>)}{!options.length && !currentFiltered && <p>No exercises available for this muscle group.</p>}</>}</div></dialog>}
  </section>;
}
