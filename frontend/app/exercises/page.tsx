'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Icon } from '../../sections/Home/icons';

const MUSCLES = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
const EQUIPMENT = ['All', 'Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Kettlebell'];

export default function ExerciseLibraryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [selectedEquipment, setSelectedEquipment] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getExercises({
        search: searchTerm || undefined,
        muscle: selectedMuscle === 'All' ? undefined : selectedMuscle,
        equipment: selectedEquipment === 'All' ? undefined : selectedEquipment,
        page: 1,
        limit: 100,
      });
      setItems(data?.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedMuscle, selectedEquipment]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  return (
    <div className="exercise-library" style={{ background: '#0f172a', color: '#f1f5f9', minHeight: '100vh', padding: '2rem 1rem' }}>
      <header className="scan-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Exercise Library</h2>
      </header>

      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search exercises..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #334155', background: '#1e293b', color: '#f8fafc', flex: '1 1 200px' }}
        />
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {MUSCLES.map(m => (
            <button key={m} onClick={() => setSelectedMuscle(m)} style={{ padding: '0.35rem 0.6rem', borderRadius: '0.75rem', border: 'none', background: selectedMuscle === m ? '#3b82f6' : '#1e293b', color: '#f8fafc', fontSize: '0.85rem', cursor: 'pointer' }}>{m}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {EQUIPMENT.map(e => (
            <button key={e} onClick={() => setSelectedEquipment(e)} style={{ padding: '0.35rem 0.6rem', borderRadius: '0.75rem', border: 'none', background: selectedEquipment === e ? '#6366f1' : '#1e293b', color: '#f8fafc', fontSize: '0.85rem', cursor: 'pointer' }}>{e}</button>
          ))}
        </div>
      </div>

      {loading && <p style={{ color: '#94a3b8' }}>Loading exercises...</p>}
      {!loading && items.length === 0 && <p style={{ color: '#94a3b8' }}>No exercises found.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {items.map((ex: any) => (
          <button
            key={ex._id || ex.id || ex.name}
            onClick={() => setSelected(ex)}
            style={{
              textAlign: 'left',
              padding: '1rem',
              borderRadius: '0.75rem',
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{ex.name}</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{ex.targetMuscle || '—'} · {ex.equipment || '—'} · {ex.difficulty || '—'}</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ padding: '0.15rem 0.4rem', borderRadius: '0.5rem', background: ex.trackingStatus === 'AI tracked' ? '#10b98122' : ex.trackingStatus === 'Caution' ? '#f59e0b22' : '#64748b22', color: ex.trackingStatus === 'AI tracked' ? '#34d399' : ex.trackingStatus === 'Caution' ? '#fbbf24' : '#94a3b8', fontWeight: 600 }}>{ex.trackingStatus || 'Manual'}</span>
            </div>
            {ex.pictureUrl && <img src={ex.pictureUrl} alt={ex.name} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '0.5rem', marginTop: '0.5rem', display: 'block', background: '#334155' }} />}
          </button>
        ))}
      </div>

      {/* Modal for selected exercise */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setSelected(null)}>
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '1rem', padding: '1.5rem', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflow: 'auto', color: '#f8fafc' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{selected.name}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }} aria-label="Close">×</button>
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>{selected.targetMuscle} · {selected.equipment} · {selected.difficulty}</div>
            {selected.videoUrl && (
              <video src={selected.videoUrl} controls autoPlay loop muted style={{ width: '100%', borderRadius: '0.5rem', background: '#1e293b', maxHeight: '240px' }} />
            )}
            {selected.pictureUrl && !selected.videoUrl && (
              <img src={selected.pictureUrl} alt={selected.name} style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '0.5rem', display: 'block', background: '#334155' }} />
            )}
            <h4 style={{ marginTop: '1rem', fontWeight: 600 }}>Instructions</h4>
            <ol style={{ paddingLeft: '1.2rem', lineHeight: 1.6 }}>
              {(selected.instructions || []).map((step: string, i: number) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
              Tracking: <span style={{ color: selected.trackingStatus === 'AI tracked' ? '#34d399' : selected.trackingStatus === 'Caution' ? '#fbbf24' : '#94a3b8', fontWeight: 600 }}>{selected.trackingStatus || 'Manual'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
