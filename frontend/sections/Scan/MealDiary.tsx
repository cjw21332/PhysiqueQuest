'use client';
import { useState } from 'react';
import { Icon } from '../Home/icons';
import { titleCase } from '../../lib/titleCase';
import { mealNames, type FoodEntry, type MealName } from './types';
import { nutrientLabel, nutrientTotal } from './nutrientTotal';

const mealIcons: Record<MealName, string> = { Breakfast: 'meal-breakfast', Lunch: 'meal-lunch', Dinner: 'meal-dinner', Snack: 'meal-snack' };

export default function MealDiary({ meals, onAdd, onEdit }: { meals: FoodEntry[]; onAdd: (meal: MealName) => void; onEdit: (entries: FoodEntry[]) => void }) {
  const [open, setOpen] = useState<MealName[]>([]);
  return <div className="meal-diary-list">{mealNames.map(meal => {
    const entries = meals.filter(item => item.meal === meal);
    const expanded = open.includes(meal);
    const calories = nutrientTotal(entries, item => item.calories);
    const summary = entries.length ? `${titleCase(entries[0].name)}${entries.length > 1 ? ` and ${entries.length - 1} more` : ''}` : 'No foods logged yet';
    return <article className="meal-diary-card" key={meal}>
      <div className="meal-diary-header"><button type="button" className="meal-diary-toggle" aria-expanded={expanded} aria-controls={`meal-diary-${meal}`} onClick={() => setOpen(current => expanded ? current.filter(value => value !== meal) : [...current, meal])}>
        <span className="meal-diary-icon"><Icon name={mealIcons[meal]} size={20}/></span><span className="meal-diary-copy"><strong>{meal}</strong><span>{summary}</span><small>{entries.length ? `${nutrientLabel(calories, 'kcal')} · ${entries.length} ${entries.length === 1 ? 'food' : 'foods'}` : 'Tap to view foods'}</small></span><span className={`meal-diary-chevron ${expanded ? 'open' : ''}`} aria-hidden="true"><Icon name="chevron-down" size={18}/></span>
      </button><button type="button" className="meal-diary-add" onClick={() => onAdd(meal)} aria-label={`Add food to ${meal}`}><Icon name="plus" size={18}/> Add</button></div>
      <div id={`meal-diary-${meal}`} hidden={!expanded} className="meal-diary-items">{entries.length ? entries.map(entry => <button type="button" className="meal-diary-food" key={entry.id} onClick={() => onEdit([entry])} aria-label={`Edit ${titleCase(entry.name)} in ${meal}`}><span><strong>{titleCase(entry.name)}</strong><small>{[entry.detail && entry.detail !== entry.name ? entry.detail : '', entry.source, entry.edited ? 'edited' : '', entry.time].filter(Boolean).join(' · ')}</small></span><span>{nutrientLabel(entry.calories, 'kcal')} <Icon name="edit" size={15}/></span></button>) : <p>No foods in {meal.toLowerCase()} yet. Add a food to get started.</p>}</div>
    </article>;
  })}</div>;
}
