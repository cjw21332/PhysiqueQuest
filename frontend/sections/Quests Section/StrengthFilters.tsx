'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type ExerciseRecord } from '../../lib/api';
import { muscleNames, resolveProgressMuscles } from '../../lib/progressMuscles';
import { titleCase } from '../../lib/titleCase';
import { useCoachPlan } from '../../hooks/useCoachPlan';

type Exercise = { id: string; name: string };
export default function StrengthFilters({ exercises, selected, onSelect, loading, error }: { exercises: Exercise[]; selected: string; onSelect: (id: string) => void; loading: boolean; error: boolean }) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('All muscles');
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
    const search = query.trim().toLocaleLowerCase();
    const options = classified.filter(item => (muscle === 'All muscles' || item.muscles.includes(muscle)) && item.name.toLocaleLowerCase().includes(search)).sort((a, b) => a.name.localeCompare(b.name));
    return { options, groups };
  }, [exercises, plan, catalog, muscle, query]);
  const current = exercises.find(item => item.id === selected);
  const currentFiltered = current && !options.some(item => item.id === current.id);
  return <section className="strength-filter-card" aria-label="Find an exercise">
    <div className="strength-filter-heading"><div><h3>Choose an exercise</h3><p>Filter the leaderboard by muscle or search by name.</p></div><span>{loading && !exercises.length ? 'Loading…' : `${exercises.length} available`}</span></div>
    <div className="strength-filter-fields">
      <label>Muscle group<select value={muscle} onChange={event => setMuscle(event.target.value)}><option>All muscles</option>{groups.map(group => <option key={group}>{group}</option>)}</select></label>
      <label>Search exercises<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. bench press" /></label>
      <label className="strength-filter-choice">Exercise<select value={selected} onChange={event => onSelect(event.target.value)} disabled={!exercises.length}>
        {!selected && <option value="">Choose an exercise</option>}
        {currentFiltered && <option value={current.id}>{titleCase(current.name)} (current)</option>}
        {options.map(item => <option key={item.id} value={item.id}>{titleCase(item.name)}</option>)}
      </select></label>
    </div>
    {current && <p className="strength-filter-current">Showing rankings for <strong>{titleCase(current.name)}</strong></p>}
    <p className="strength-filter-hint" role="status">{loading && !exercises.length ? 'Loading exercises…' : error && !exercises.length ? 'Exercises are unavailable. Try loading the rankings again.' : !exercises.length ? 'No ranked exercises are available yet.' : options.length ? `${options.length} ${options.length === 1 ? 'exercise matches' : 'exercises match'} your filters.` : 'No exercises match. Try another search or muscle group.'}</p>
    <p className="strength-filter-note">Muscle groups may be estimated from exercise names.</p>
  </section>;
}
