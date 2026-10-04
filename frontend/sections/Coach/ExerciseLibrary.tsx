'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { Icon } from '../Home/icons';

const MUSCLES = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
const EQUIPMENT = ['Any equipment', 'Dumbbells', 'Bodyweight', 'Resistance bands', 'Full gym'];

type ExerciseItem = {
  _id?: string;
  name: string;
  targetMuscle?: string;
  equipment?: string;
  difficulty?: string;
  trackingStatus?: string;
  pictureUrl?: string;
  videoUrl?: string;
  instructions?: string[];
  slug?: string;
};

export default function ExerciseLibrary({ onBack, selectedEquipment }: { onBack: () => void; selectedEquipment: string[] }) {
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const initialEquipment = selectedEquipment[0] === 'Dumbbells' ? 'Dumbbells' : 'Any equipment';
  const [equipmentState, setEquipmentState] = useState(initialEquipment);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ExerciseItem | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchExercises = useCallback(async (q: string, m: string, e: string) => {
    setLoading(true);
    try {
      const data = await api.getExercises({
        search: q || undefined,
        muscle: m === 'All' ? undefined : m,
        equipment: e === 'Any equipment' ? undefined : e,
        page: 1,
        limit: 100,
      });
      setExercises(data?.items ?? []);
    } catch {
      setExercises([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchExercises(searchTerm.trim(), selectedMuscle, equipmentState === 'Any equipment' ? initialEquipment : equipmentState), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTerm, selectedMuscle, equipmentState, fetchExercises, initialEquipment]);

  const handleSelect = (ex: ExerciseItem) => {
    setSelected(ex);
  };

  return (
    <>
      <header className="coach-header">
        <button className="coach-back" onClick={onBack} aria-label="Back to AI Coach"><Icon name="arrow" size={24}/></button>
        <h2>Exercise library</h2>
      </header>

      <label className="library-search">
        <Icon name="scan" size={16}/>
        <input placeholder="Search Exercise" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
        {searchTerm && <button onClick={() => setSearchTerm('')} aria-label="Clear search">×</button>}
      </label>

      <div className="filter-row">
        {MUSCLES.map(item => (
          <button key={item} className={selectedMuscle === item ? 'selected' : ''} onClick={() => setSelectedMuscle(item)}>{item}</button>
        ))}
      </div>

      <div className="filter-row equipment-filters">
        {EQUIPMENT.map(item => (
          <button key={item} className={equipmentState === item ? 'selected' : ''} onClick={() => setEquipmentState(item)}>{item}</button>
        ))}
      </div>

      <p className="result-count">{loading ? 'Loading...' : `${exercises.length} results`}</p>

      <div className="library-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {exercises.map(item => (
          <button className="library-item" key={item._id || item.name} onClick={() => handleSelect(item)}>
            <span className="exercise-thumb">
              {item.pictureUrl ? <img src={item.pictureUrl} alt={item.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} /> : <Icon name="dumbbell" size={22}/>}
              <i>▶</i>
            </span>
            <span className="library-copy">
              <b>{item.name}</b>
              <small>{item.targetMuscle || '—'} · {item.equipment || '—'} · {item.difficulty || '—'}</small>
            </span>
            <span className={`tracking-tag ${item.trackingStatus === 'Caution' ? 'caution' : item.trackingStatus === 'Manual' ? 'manual' : ''}`}>{item.trackingStatus || 'Manual'}</span>
          </button>
        ))}
        {!loading && !exercises.length && <div className="empty-library">No exercises match those filters.</div>}
      </div>

      {selected && (
        <div className="coach-overlay" role="dialog" aria-modal="true" aria-label={`${selected.name} details`}>
          <div className="exercise-sheet" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <button className="sheet-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            {selected.videoUrl ? (
              <video src={selected.videoUrl} autoPlay loop muted playsInline style={{ width: '100%', maxHeight: 240, borderRadius: 12, background: '#0f172a' }} />
            ) : selected.pictureUrl ? (
              <img src={selected.pictureUrl} alt={selected.name} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, display: 'block', background: '#334155' }} />
            ) : (
              <div style={{ width: '100%', height: 160, background: '#1e293b', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>No media</div>
            )}
            <h3>{selected.name}</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{selected.targetMuscle} · {selected.equipment} · {selected.difficulty}</p>
            <span className={`tracking-tag ${selected.trackingStatus === 'Caution' ? 'caution' : selected.trackingStatus === 'Manual' ? 'manual' : ''}`}>{selected.trackingStatus || 'Manual'}</span>

            <h4 style={{ marginTop: '1rem', fontWeight: 600 }}>Instructions</h4>
            <ol style={{ paddingLeft: '1.2rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
              {(selected.instructions || []).map((step, i) => <li key={i}>{step}</li>)}
            </ol>

            <button className="primary" onClick={() => setSelected(null)}>Add to today plan</button>
          </div>
        </div>
      )}
    </>
  );
}
