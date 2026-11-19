'use client';
import { titleCase } from '../../lib/titleCase';

import { useState } from 'react';
import { Icon } from '../Home/icons';
import { mealNames, type FoodEntry } from './types';
import FoodNameSearch from './FoodNameSearch';
import DeleteConfirmation from '../../components/DeleteConfirmation';

const nutrients = ['calories', 'protein', 'carbs', 'fat', 'saturatedFat', 'transFat', 'fiber', 'sugars', 'addedSugar', 'sodium', 'cholesterol'] as const;
const weightOf = (item: FoodEntry) => item.estWeightG || (item.servingUnit === 'g' ? item.servingQuantity : undefined);

export default function EditMeal({ entries, onBack, onSave, onDelete }: { entries: FoodEntry[]; onBack: () => void; onSave: (entry: FoodEntry) => Promise<void>; onDelete: (entry: FoodEntry) => Promise<void> }) {
  const [entry, setEntry] = useState(entries[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [quantity, setQuantity] = useState(String(weightOf(entries[0]) ?? ''));
  const [baseline, setBaseline] = useState(entries[0]);
  const [unit, setUnit] = useState<'grams' | 'servings'>('grams');
  const [serving, setServing] = useState(String(entries[0].servingSizeG ?? ''));
  const servingSize = Number(serving);
  const validServing = Number.isFinite(servingSize) && servingSize > 0 && servingSize <= 100000;
  const changeQuantity = (value: string, nextUnit = unit, basis = servingSize) => {
    setQuantity(value);
    const next = Number(value) * (nextUnit === 'servings' ? basis : 1), original = weightOf(baseline);
    if (!value) { if (!original) setEntry(current => ({ ...current, estWeightG: undefined })); return; }
    if (!Number.isFinite(next) || next <= 0 || next > 100000) return;
    setEntry(current => {
      const updated = { ...current, estWeightG: next, ...(nextUnit === 'servings' && basis > 0 ? { servingSizeG: basis } : {}), detail: `${current.name} · ${Number(next.toFixed(4))} g` };
      if (original) for (const key of nutrients) {
        const amount = baseline[key];
        if (typeof amount === 'number') updated[key] = Number((amount * next / original).toFixed(2));
      }
      return updated;
    });
  };
  const grams = Number(quantity) * (unit === 'servings' ? servingSize : 1);
  const quantityValid = quantity === '' && unit === 'grams' ? !weightOf(baseline) : (unit === 'grams' || validServing) && Number.isFinite(grams) && grams > 0 && grams <= 100000;
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !quantityValid) return;
    setSaving(true); setError('');
    try { await onSave({ ...entry, name: entry.name.trim() }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save changes. Please try again.'); }
    finally { setSaving(false); }
  };
  return <form className="meal-edit meal-editor" onSubmit={save}>
    <header className="scan-header add-food-header pq-page-heading"><button type="button" className="coach-back" onClick={onBack} disabled={saving} aria-label="Back to Nutrition"><Icon name="arrow" size={20}/></button><h2>Edit meal</h2></header>
    <div className="meal-editor-intro"><span>YOUR FOOD LOG</span><h1>Make it yours.</h1><p>Adjust the portion and nutrition to match what you ate.</p></div>
    <div className="meal-editor-card"><div className="meal-editor-heading"><div><span>01 / FOOD</span><h3>Meal details</h3></div><span className="meal-editor-source">{entry.source}</span></div>
    {entries.length > 1 && <label className="meal-edit-field">Food to edit<select disabled={saving} value={entry.id} onChange={event => { const next = entries.find(item => item.id === event.target.value)!; setEntry(next); setBaseline(next); setQuantity(String(weightOf(next) ?? '')); setUnit('grams'); setServing(String(next.servingSizeG ?? '')); setError(''); }}>{entries.map(item => <option key={item.id} value={item.id}>{titleCase(item.name)}</option>)}</select></label>}
    <FoodNameSearch key={entry.id} value={entry.name} disabled={saving} onChange={name => setEntry({ ...entry, name, fdcId: undefined })} onSelect={food => setEntry({ ...entry, name: food.description.slice(0, 120), fdcId: food.fdc_id })}/>
    <fieldset disabled={saving} className="meal-edit-category"><legend>Meal</legend><div className="scan-chips">{mealNames.map(meal => <button type="button" key={meal} className={entry.meal === meal ? 'active' : ''} aria-pressed={entry.meal === meal} onClick={() => setEntry({ ...entry, meal })}>{meal}</button>)}</div></fieldset>
    <div className="meal-unit-heading"><label htmlFor="meal-quantity">Quantity</label><div className="meal-unit-switch" role="group" aria-label="Quantity unit">{(['grams', 'servings'] as const).map(value => <button type="button" key={value} disabled={saving} aria-pressed={unit === value} onClick={() => { if (unit === value) return; const currentGrams = weightOf(entry); setUnit(value); setQuantity(currentGrams && (value === 'grams' || validServing) ? String(Number((value === 'grams' ? currentGrams : currentGrams / servingSize).toFixed(6))) : ''); }}>{value === 'grams' ? 'Grams' : 'Servings'}</button>)}</div></div>
    <label className="meal-edit-field meal-editor-quantity"><span className="meal-editor-input"><input id="meal-quantity" type="number" min="0.000001" step="any" inputMode="decimal" placeholder="Not recorded" disabled={saving} value={quantity} aria-describedby="meal-quantity-hint" aria-invalid={!quantityValid} onChange={event => changeQuantity(event.target.value)}/><span>{unit === 'grams' ? 'g' : 'servings'}</span></span></label>
    {unit === 'servings' && <label className="meal-edit-field meal-serving-size">Grams per serving<input type="number" min="0.000001" max="100000" step="any" inputMode="decimal" placeholder="Enter serving weight" disabled={saving} value={serving} onChange={event => { const value = event.target.value, size = Number(value); setServing(value); if (Number.isFinite(size) && size > 0 && size <= 100000) { const currentWeight = weightOf(entry); if (currentWeight) { setQuantity(String(Number((currentWeight / size).toFixed(6)))); setEntry(current => ({ ...current, servingSizeG: size })); } else if (quantity) changeQuantity(quantity, 'servings', size); } }}/></label>}
    <p id="meal-quantity-hint" className="meal-editor-hint">{unit === 'servings' && !validServing ? 'Enter the weight of one serving to calculate the portion.' : weightOf(baseline) ? 'Nutrition adjusts when you change the portion.' : 'No original weight was recorded. Enter a portion and review the nutrition values.'}</p></div>
    {!quantityValid && <p className="error" role="alert">Enter a valid quantity and serving weight, up to 100,000 g.</p>}
    <div className="meal-editor-card"><div className="meal-editor-heading"><div><span>02 / NUTRITION</span><h3>Nutrition values</h3></div></div><p className="meal-editor-hint">For this portion. You can edit these values.</p>
    <div className="meal-edit-grid">{([{ key: 'calories', label: 'Calories', unit: 'kcal' }, { key: 'protein', label: 'Protein', unit: 'g' }, { key: 'carbs', label: 'Carbohydrates', unit: 'g' }, { key: 'fat', label: 'Fat', unit: 'g' }] as const).map(({ key, label, unit }) => <label className="meal-edit-field" key={key}>{label} ({unit})<input type="number" placeholder="Unavailable" min="0" step="any" inputMode="decimal" disabled={saving} value={entry[key] ?? ''} onChange={event => { const updated = { ...entry, [key]: event.target.value === '' ? null : Number(event.target.value) }; setEntry(updated); setBaseline(updated); }}/></label>)}</div></div>
    {error && <p className="error" role="alert">{error}</p>}
    <button type="button" className="meal-delete-button" disabled={saving} onClick={() => setDeleting(true)}><Icon name="trash" size={17}/> Delete entry</button>
    {deleting && <DeleteConfirmation title="Delete this entry?" description={`${entry.meal} · ${entry.name}${entry.calories == null ? '' : ` (${entry.calories} kcal)`} will be removed and today's totals recalculated.`} confirmLabel="Delete entry" busy={saving} onCancel={() => setDeleting(false)} onConfirm={() => { setSaving(true); void onDelete(entry).catch(err => { setError(err instanceof Error ? err.message : 'Could not delete entry.'); setDeleting(false); }).finally(() => setSaving(false)); }}/>}
    <footer className="scan-footer split-footer"><button type="button" className="secondary" onClick={onBack} disabled={saving}>Cancel</button><button type="submit" className="primary" disabled={saving || !quantityValid || !entry.name.trim() || [entry.calories, entry.protein, entry.carbs, entry.fat].some(value => value !== null && (!Number.isFinite(value) || value < 0))}>{saving ? 'Saving…' : 'Save changes'}</button></footer>
  </form>;
}
