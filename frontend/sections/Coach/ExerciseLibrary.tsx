'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../Home/icons';
import { equipmentTypes, exercises, muscles, type Exercise } from './exercises';

export default function ExerciseLibrary({ onBack, selectedEquipment }: { onBack: () => void; selectedEquipment: string[] }) {
  const initialEquipment = selectedEquipment[0] === 'Dumbbells' ? 'Dumbbells' : 'Any equipment';
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('All');
  const [equipment, setEquipment] = useState(initialEquipment);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const filtered = useMemo(() => exercises.filter(item => (muscle === 'All' || item.muscle === muscle) && (equipment === 'Any equipment' || item.equipment === equipment) && item.name.toLowerCase().includes(query.toLowerCase())), [query, muscle, equipment]);
  return <><header className="coach-header"><button className="coach-back" onClick={onBack} aria-label="Back">‹</button><h2>Exercise library</h2></header><label className="library-search"><Icon name="scan" size={15}/><input placeholder="Search Exercise" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button onClick={() => setQuery('')} aria-label="Clear search">×</button>}</label><div className="filter-row">{muscles.map(item => <button key={item} className={muscle === item ? 'selected' : ''} onClick={() => setMuscle(item)}>{item}</button>)}</div><div className="filter-row equipment-filters">{equipmentTypes.map(item => <button key={item} className={equipment === item ? 'selected' : ''} onClick={() => setEquipment(item)}>{item}</button>)}</div><p className="result-count">{filtered.length} results</p><div className="library-list">{filtered.map(item => <button className="library-item" key={item.name} onClick={() => setSelected(item)}><span className="exercise-thumb"><Icon name="dumbbell" size={19}/><i>▶</i></span><span className="library-copy"><b>{item.name}</b><small>{item.muscle} · {item.equipment} · {item.level}</small></span><Tag tag={item.tag}/></button>)}{!filtered.length && <div className="empty-library">No exercises match those filters.</div>}</div>{selected && <div className="coach-overlay" role="dialog" aria-modal="true" aria-label={`${selected.name} details`}><div className="exercise-sheet"><button className="sheet-close" onClick={() => setSelected(null)} aria-label="Close">×</button><span className="exercise-thumb large-thumb"><Icon name="dumbbell" size={25}/></span><Tag tag={selected.tag}/><h3>{selected.name}</h3><p>{selected.muscle} · {selected.equipment} · {selected.level}</p><div className="exercise-tip"><b>Form guide</b><span>{selected.tip}</span></div><button className="primary" onClick={() => setSelected(null)}>Add to today’s plan</button></div></div>}</>;
}
export function Tag({ tag }: { tag: Exercise['tag'] }) { return <span className={`tracking-tag ${tag === 'Caution' ? 'caution' : tag === 'Manual' ? 'manual' : ''}`}>{tag === 'Caution' && '⚠ '}{tag}</span>; }
