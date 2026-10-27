'use client';
import { titleCase } from '../../lib/titleCase';

import { useState } from 'react';
import { Icon } from '../Home/icons';
import { mealNames, type FoodEntry } from './types';
import FoodNameSearch from './FoodNameSearch';

export default function EditMeal({ entries, onBack, onSave }: { entries: FoodEntry[]; onBack: () => void; onSave: (entry: FoodEntry) => Promise<void> }) {
  const [entry, setEntry] = useState(entries[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try { await onSave({ ...entry, name: entry.name.trim() }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save changes. Please try again.'); }
    finally { setSaving(false); }
  };
  return <form className="meal-edit" onSubmit={save}>
    <header className="scan-header add-food-header"><button type="button" className="coach-back" onClick={onBack} disabled={saving} aria-label="Back to Today's Log"><Icon name="arrow" size={20}/></button><h2>Edit meal</h2></header>
    <p className="meal-edit-caption">Update your logged food. Its original source and logging time are kept.</p>
    {entries.length > 1 && <label className="meal-edit-field">Food to edit<select disabled={saving} value={entry.id} onChange={event => { setEntry(entries.find(item => item.id === event.target.value)!); setError(''); }}>{entries.map(item => <option key={item.id} value={item.id}>{titleCase(item.name)}</option>)}</select></label>}
    <FoodNameSearch key={entry.id} value={entry.name} disabled={saving} onChange={name => setEntry({ ...entry, name, fdcId: undefined })} onSelect={food => setEntry({ ...entry, name: food.description.slice(0, 120), fdcId: food.fdc_id })}/>
    <fieldset disabled={saving} className="meal-edit-category"><legend>Meal</legend><div className="scan-chips">{mealNames.map(meal => <button type="button" key={meal} className={entry.meal === meal ? 'active' : ''} aria-pressed={entry.meal === meal} onClick={() => setEntry({ ...entry, meal })}>{meal}</button>)}</div></fieldset>
    <h3>Nutrition</h3>
    <div className="meal-edit-grid">{([{ key: 'calories', label: 'Calories', unit: 'kcal' }, { key: 'protein', label: 'Protein', unit: 'g' }, { key: 'carbs', label: 'Carbohydrates', unit: 'g' }, { key: 'fat', label: 'Fat', unit: 'g' }] as const).map(({ key, label, unit }) => <label className="meal-edit-field" key={key}>{label} ({unit})<input type="number" required min="0" step="any" inputMode="decimal" disabled={saving} value={Number.isNaN(entry[key]) ? '' : entry[key]} onChange={event => setEntry({ ...entry, [key]: event.target.value === '' ? NaN : Number(event.target.value) })}/></label>)}</div>
    {error && <p className="error" role="alert">{error}</p>}
    <footer className="scan-footer split-footer"><button type="button" className="secondary" onClick={onBack} disabled={saving}>Cancel</button><button type="submit" className="primary" disabled={saving || !entry.name.trim() || [entry.calories, entry.protein, entry.carbs, entry.fat].some(value => !Number.isFinite(value) || value < 0)}>{saving ? 'Saving…' : 'Save changes'}</button></footer>
  </form>;
}
