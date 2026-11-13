'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type ExerciseRecord, type WorkoutSummary } from '../../lib/api';
import { useCoachPlan } from '../../hooks/useCoachPlan';
import { resolveProgressMuscles, muscleNames } from '../../lib/progressMuscles';
import { titleCase } from '../../lib/titleCase';

type RecordItem = WorkoutSummary['personalRecords'][number];
type Sort = 'weight' | 'volume' | 'az' | 'za';
const number = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(value);
const volumeNumber = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
const date = (value: string) => { const parsed = new Date(value.includes('T') ? value : value + 'T12:00:00'); return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };

export default function PersonalRecords({ records, loading, error, retry }: { records: RecordItem[]; loading: boolean; error: string | null; retry: () => void }) {
  const [muscle, setMuscle] = useState('All muscles');
  const [sort, setSort] = useState<Sort>('weight');
  const [catalog, setCatalog] = useState<Record<string, ExerciseRecord>>({});
  const { plan } = useCoachPlan();
  const idsKey = JSON.stringify([...new Set(records.map(row => row.exerciseId).filter(id => !id.startsWith('personal-')))].sort());
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
  const grouped = useMemo(() => {
    const metadata = new Map<string, string[]>();
    for (const day of plan?.days ?? []) for (const exercise of day.exercises) {
      metadata.set(exercise.exerciseId, [...(metadata.get(exercise.exerciseId) ?? []), exercise.targetMuscle ?? '', exercise.group ?? '']);
    }
    const rows = records.filter(row => typeof row.loadKg === 'number' && row.loadKg > 0).map(row => {
      const targets = catalog[row.exerciseId]?.targetMuscles;
      const resolved = resolveProgressMuscles(row.name, targets?.length ? targets : metadata.get(row.exerciseId) ?? []);
      return { ...row, muscles: resolved.muscles.length ? resolved.muscles : ['Unclassified'], muscle: resolved.muscles[0] ?? 'Unclassified' };
    });
    const available = [...muscleNames, 'Unclassified'].filter(name => rows.some(row => row.muscles.includes(name)));
    const visible = rows.filter(row => muscle === 'All muscles' || row.muscles.includes(muscle));
    const compare = (a: typeof rows[number], b: typeof rows[number]) => sort === 'az' ? a.name.localeCompare(b.name) : sort === 'za' ? b.name.localeCompare(a.name) : sort === 'volume' ? (b.volumeKg ?? 0) - (a.volumeKg ?? 0) || a.name.localeCompare(b.name) : (b.loadKg ?? 0) - (a.loadKg ?? 0) || a.name.localeCompare(b.name);
    const groups = muscle === 'All muscles' ? [...new Set(visible.map(row => row.muscle))].map(name => ({ name, rows: visible.filter(row => row.muscle === name).sort(compare) })) : [{ name: muscle, rows: visible.sort(compare) }].filter(group => group.rows.length);
    groups.sort((a, b) => a.name === 'Unclassified' ? 1 : b.name === 'Unclassified' ? -1 : a.name.localeCompare(b.name));
    return { groups, available, count: visible.length };
  }, [plan, records, muscle, sort, catalog]);
  return <section className="records-page" aria-label="Personal records">
    <header className="records-intro"><div><p className="records-kicker">Your strongest lifts</p><h2>Personal records</h2><p>Your best weight for each exercise, updated as you train.</p></div><span aria-hidden="true">↗</span></header>
    {error ? <div role="alert" className="records-message">{error} <button type="button" onClick={retry}>Try again</button></div> : loading ? <p role="status" className="records-message">Loading your records…</p> : <>
      <div className="records-controls">
        <label>Muscle group<select value={muscle} onChange={event => setMuscle(event.target.value)}><option>All muscles</option>{grouped.available.map(name => <option key={name}>{name}</option>)}</select></label>
        <label>Sort by<select value={sort} onChange={event => setSort(event.target.value as Sort)}><option value="weight">Highest weight</option><option value="volume">Highest volume</option><option value="az">Name A to Z</option><option value="za">Name Z to A</option></select></label>
      </div>
      <div className="records-caption"><span>{grouped.count} {grouped.count === 1 ? 'exercise' : 'exercises'}</span><span>Grouped by muscle</span></div>
      {grouped.groups.length ? grouped.groups.map(group => <section className="records-group" key={group.name} aria-label={group.name}>
        <div className="records-group-head"><h3>{group.name}</h3><span>{group.rows.length}</span></div>
        <div className="records-list">{group.rows.map(row => {
          const unit = row.loadUnit ?? 'kg';
          const value = row.loadValue ?? row.loadKg!;
          const volume = row.volumeKg === undefined ? null : row.volumeKg * (unit === 'lbs' ? 2.2046226218 : 1);
          return <article className="records-item" key={row.exerciseId}><div className="records-item-top"><div><h4>{titleCase(row.name)}</h4><p>Best set · {date(row.date)}</p></div><strong>{number(value)} <small>{unit}</small></strong></div><div className="records-item-bottom"><span>Best workout volume</span><b>{volume === null ? '—' : `${volumeNumber(volume)} ${unit}`}</b></div></article>;
        })}</div>
      </section>) : <div className="records-message">{records.length ? 'No records match this muscle group.' : 'Complete a workout with weighted sets to see your records.'}</div>}
      <p className="records-footnote">Volume is the most weight × reps for this exercise in one workout, excluding warm-up sets. Muscle groups may be estimated from exercise names.</p>
    </>}
  </section>;
}
