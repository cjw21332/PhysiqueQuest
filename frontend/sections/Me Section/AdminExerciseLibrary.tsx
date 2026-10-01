'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../Home/icons';

type PoseStatus = 'Ready' | 'Missing' | 'Training';
type PublishStatus = 'Published' | 'Draft';
type Exercise = { id: number; name: string; group: string; status: PublishStatus; pose: PoseStatus };
type Filter = 'All' | PublishStatus | 'Missing pose';

const initialExercises: Exercise[] = [
  { id: 1, name: 'Dumbbell bench press', group: 'Chest · Dumbbells', status: 'Published', pose: 'Ready' },
  { id: 2, name: 'Overhead press', group: 'Shoulders · Dumbbells', status: 'Published', pose: 'Ready' },
  { id: 3, name: 'Bulgarian split squat', group: 'Legs · Dumbbells', status: 'Draft', pose: 'Missing' },
  { id: 4, name: 'Cable fly', group: 'Chest · Machine', status: 'Published', pose: 'Ready' },
  { id: 5, name: 'Kettlebell swing', group: 'Legs · Kettlebell', status: 'Draft', pose: 'Training' },
  { id: 6, name: 'Band pull-apart', group: 'Back · Bands', status: 'Draft', pose: 'Missing' },
];

export default function AdminExerciseLibrary({ onBack }: { onBack: () => void }) {
  const [exercises, setExercises] = useState(initialExercises);
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');

  const visibleExercises = useMemo(() => exercises.filter((exercise) => {
    const matchesFilter = filter === 'All'
      || (filter === 'Missing pose' ? exercise.pose === 'Missing' : exercise.status === filter);
    const matchesQuery = `${exercise.name} ${exercise.group}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesFilter && matchesQuery;
  }), [exercises, filter, query]);

  function addExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    setExercises((current) => [...current, {
      id: Date.now(), name: cleanName, group: group.trim() || 'General · Bodyweight', status: 'Draft', pose: 'Missing',
    }]);
    setName('');
    setGroup('');
    setShowForm(false);
    setFilter('All');
    setQuery('');
  }

  return (
    <section className="me-section admin-tools-screen" aria-label="Admin exercise library">
      <header className="admin-tools-header">
        <button className="coach-back" onClick={onBack} aria-label="Back to account settings"><Icon name="arrow" size={24} /></button>
        <h2>Admin · Exercises</h2>
        <button className="admin-new-button" onClick={() => setShowForm(true)}><span aria-hidden="true">＋</span> New</button>
      </header>

      <div className="admin-tools-scroll">
        <label className="admin-search">
          <Icon name="search" size={15} />
          <span className="visually-hidden">Search exercises</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search content" />
        </label>

        <div className="admin-filters" role="group" aria-label="Filter exercise records">
          {(['All', 'Published', 'Draft', 'Missing pose'] as Filter[]).map((option) => (
            <button key={option} className={filter === option ? 'active' : ''} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}</button>
          ))}
        </div>

        <div className="admin-list-caption"><span>Exercise <small>Sample records</small></span><span>Status</span><span>Pose</span></div>
        <div className="admin-exercise-list">
          {visibleExercises.map((exercise) => (
            <article className="admin-exercise-row" key={exercise.id}>
              <div className="admin-exercise-copy"><b>{exercise.name}</b><small>{exercise.group}</small></div>
              <span className={`admin-status ${exercise.status.toLowerCase()}`}>{exercise.status}</span>
              <span className={`admin-pose ${exercise.pose.toLowerCase()}`}>{exercise.pose}</span>
            </article>
          ))}
          {visibleExercises.length === 0 && <p className="admin-empty-state">No exercises match this search.</p>}
        </div>
      </div>

      {showForm && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
        <form className="admin-exercise-form" role="dialog" aria-modal="true" aria-labelledby="admin-exercise-form-title" onSubmit={addExercise} onKeyDown={(event) => { if (event.key === 'Escape') setShowForm(false); }}>
          <button type="button" className="admin-modal-close" aria-label="Close" onClick={() => setShowForm(false)}>×</button>
          <h3 id="admin-exercise-form-title">New exercise</h3>
          <label>Exercise name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label>
          <label>Muscle · equipment<input value={group} onChange={(event) => setGroup(event.target.value)} maxLength={80} placeholder="e.g. Chest · Dumbbells" /></label>
          <p>New exercises are saved as drafts until reviewed.</p>
          <button className="admin-save-button" type="submit">Create draft</button>
        </form>
      </div>}
    </section>
  );
}
