'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mealNames, type MealName } from './types';
import { api, type FoodCandidate, type FoodDetail } from '../../lib/api';
import { Icon } from '../Home/icons';
import { previewFoods } from './nutritionPresentation';

type FoodSelection = FoodCandidate & { detail?: FoodDetail };
type SavedFood = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  per: string;
  group: string;
  fdcId: number;
  description: string;
  servingSizeG: number;
};

const RECENT_KEY = 'physiquequest-recent-foods';
const SUGGESTIONS = ['Chicken breast', 'White rice', 'Egg', 'Banana'];
const round = (value: number) => Math.round(value * 10) / 10;

export default function AddFood({
  initialMeal,
  onBack,
  onSave,
  preview = false,
}: {
  initialMeal: MealName;
  onBack: () => void;
  onSave: (food: SavedFood, meal: MealName, amount: number, unit: 'grams' | 'servings') => void | Promise<void>;
  preview?: boolean;
}) {
  const [meal, setMeal] = useState<MealName>(initialMeal);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSelection[]>(preview ? previewFoods.slice(0, 3) : []);
  const [selected, setSelected] = useState<FoodSelection | null>(preview ? previewFoods[0] : null);
  const [recent, setRecent] = useState<string[]>(SUGGESTIONS);
  const [amount, setAmount] = useState('150');
  const [unit, setUnit] = useState<'grams' | 'servings'>('grams');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQueryRef = useRef('');
  const detailRequestRef = useRef(0);

  useEffect(() => {
    if (preview) return;
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      if (Array.isArray(stored)) setRecent(stored.filter((value): value is string => typeof value === 'string').slice(0, 6));
    } catch { /* Use the suggested foods when there is no saved history. */ }
  }, [preview]);

  const fetchResults = useCallback(async (search: string) => {
    const trimmed = search.trim();
    latestQueryRef.current = trimmed;
    if (!trimmed) { setResults([]); setLoading(false); setError(''); return; }
    setLoading(true);
    setError('');
    try {
      const response = await api.searchFoods(trimmed);
      if (latestQueryRef.current === trimmed) setResults(response.candidates.slice(0, 5));
    } catch (err) {
      if (latestQueryRef.current === trimmed) {
        setResults([]);
        setError(err instanceof Error ? err.message : 'Food search is unavailable. Try again.');
      }
    } finally {
      if (latestQueryRef.current === trimmed) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (preview) {
      const found = query.trim() ? previewFoods.filter(food => food.description.toLowerCase().includes(query.trim().toLowerCase())) : previewFoods.slice(0, 3);
      setResults(found); setSelected(found[0] ?? null); setLoading(false); setError(''); return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    latestQueryRef.current = query.trim();
    detailRequestRef.current += 1;
    setDetailLoading(false);
    setSelected(null);
    if (query.trim()) {
      setResults([]);
      setError('');
      setLoading(true);
      debounceRef.current = setTimeout(() => void fetchResults(query), 500);
    } else { setResults([]); setLoading(false); setError(''); }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchResults, preview]);

  const selectFood = async (food: FoodCandidate) => {
    const requestId = ++detailRequestRef.current;
    const item: FoodSelection = results.find(result => result.fdc_id === food.fdc_id) ?? { ...food };
    setSelected(item);
    setError('');
    if (item.detail) { setDetailLoading(false); return; }
    setDetailLoading(true);
    try {
      const detail = await api.getFoodDetail(food.fdc_id);
      if (detailRequestRef.current === requestId) setSelected({ ...item, detail });
    } catch (err) {
      if (detailRequestRef.current === requestId) setError(err instanceof Error ? err.message : 'Could not load nutrition for this food.');
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false);
    }
  };

  const servingSizeG = selected?.detail?.serving_size_g ?? 100;
  const grams = unit === 'grams' ? Number(amount) : Number(amount) * servingSizeG;
  const scale = grams / 100;
  const macros = selected?.detail?.per_100g;
  const calculated = useMemo(() => macros && Number.isFinite(scale) ? {
    kcal: macros.kcal * scale,
    protein: macros.protein_g * scale,
    carbs: macros.carbs_g * scale,
    fat: macros.fat_g * scale,
  } : null, [macros, scale]);

  const useRecent = (food: string) => {
    setQuery(food);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!selected || !selected.detail || !calculated || !Number.isFinite(grams) || grams <= 0) return;
    const nextRecent = [selected.description, ...recent.filter(name => name !== selected.description)].slice(0, 6);
    setSaving(true); setError('');
    try { await onSave({
      name: selected.description,
      calories: round(calculated.kcal),
      protein: round(calculated.protein),
      carbs: round(calculated.carbs),
      fat: round(calculated.fat),
      per: 'per 100 g',
      group: selected.data_type,
      fdcId: selected.fdc_id,
      description: selected.description,
      servingSizeG,
    }, meal, Number(amount), unit);
      if (!preview) {
        setRecent(nextRecent);
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent)); } catch { /* The confirmed meal save remains successful. */ }
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save food. Try again.'); }
    finally { setSaving(false); }
  };

  const validAmount = Number.isFinite(Number(amount)) && Number(amount) > 0;
  return (
    <div className="add-food-screen">
      <header className="scan-header add-food-header">
        <button className="coach-back" onClick={onBack} aria-label="Back"><Icon name="arrow" size={20} /></button>
        <h2>Add food</h2>
      </header>

      <div className="add-food-content">
        <div className="scan-chips meal-select" aria-label="Choose a meal">
          {mealNames.map(item => <button key={item} className={meal === item ? 'active' : ''} aria-pressed={meal === item} onClick={() => setMeal(item)}>{item}</button>)}
        </div>

        <label className="food-search">
          <Icon name="search" size={16} />
          <input aria-label="Search food" placeholder="Search food" value={query} onChange={event => setQuery(event.target.value)} />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
        </label>

        <section className="recent-foods" aria-label="Recent and frequent foods">
          <b>Recent &amp; frequent</b>
          <div>{(recent.length ? recent : SUGGESTIONS).map(food => <button key={food} type="button" onClick={() => useRecent(food)}>{food}</button>)}</div>
        </section>

        <section className="food-results" aria-label="Search results">
          <div className="section-head"><h3>Results</h3><small>{loading ? 'Searching…' : `${results.length} found`}</small></div>
          <div className="food-result-list">
            {results.map(food => {
              const isSelected = selected?.fdc_id === food.fdc_id;
              const detail = isSelected ? selected?.detail : food.detail;
              return <button type="button" key={food.fdc_id} className={isSelected ? 'selected' : ''} aria-pressed={isSelected} onClick={() => void selectFood(food)}>
                <i className={isSelected ? 'checked' : ''} aria-hidden="true" />
                <span><b>{food.description}</b><small>{food.data_type} · per 100 g</small></span>
                <strong>{detail ? `${Math.round(detail.per_100g.kcal)} kcal` : 'Select to load'}</strong>
              </button>;
            })}
            {!loading && !results.length && <>
              <p className="empty-food-results" role={error ? 'alert' : undefined}>{error || (query ? 'No foods found. Try another search.' : 'Search or choose a recent food.')}</p>
              {error && <button type="button" className="scan-retry" onClick={() => void fetchResults(query)}>Try again</button>}
            </>}
          </div>
        </section>

        <section className="portion-entry">
          <h3>Portion</h3>
          <div className="quantity-row">
            <label><small>Quantity</small><input type="number" min="0.1" step="any" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} aria-label="Quantity" /></label>
            <div className="scan-chips" aria-label="Portion unit">
              {(['grams', 'servings'] as const).map(value => <button type="button" key={value} className={unit === value ? 'active' : ''} aria-pressed={unit === value} onClick={() => { if (value !== unit) setAmount(String(round(value === 'grams' ? grams : grams / servingSizeG))); setUnit(value); }}>{value}</button>)}
            </div>
          </div>
          <div className="calculated-head"><h3>Calculated nutrition</h3><small>{unit === 'grams' ? `${Number(amount) || 0} g` : `${round(grams) || 0} g`}</small></div>
          {detailLoading && <p className="food-detail-loading" role="status">Loading nutrition…</p>}
          {!detailLoading && selected && !selected.detail && error && <p className="food-detail-loading" role="alert">{error}</p>}
          {[
            ['Calories', calculated ? `${Math.round(calculated.kcal)} kcal` : '—'],
            ['Protein', calculated ? `${calculated.protein.toFixed(1)} g` : '—'],
            ['Carbohydrates', calculated ? `${calculated.carbs.toFixed(1)} g` : '—'],
            ['Fat', calculated ? `${calculated.fat.toFixed(1)} g` : '—'],
          ].map(([label, value]) => <div className="food-value" key={label}><span>{label}</span><b>{value}</b></div>)}
          {unit === 'servings' && <small className="serving-basis">One serving = {round(servingSizeG)} g{selected?.detail?.serving_size_g ? '' : ' (USDA serving size unavailable)'}</small>}
        </section>
      </div>

      <footer className="scan-footer add-food-footer">
        {error && selected?.detail && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={saving || !selected?.detail || detailLoading || !calculated || !validAmount} onClick={()=>void handleSave()}>{saving ? 'Saving…' : `Save to ${meal}`}</button>
      </footer>
    </div>
  );
}
