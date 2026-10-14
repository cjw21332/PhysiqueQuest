'use client';

import { useEffect, useState } from 'react';
import { api, type FoodCandidate } from '../../lib/api';

export default function FoodNameSearch({ value, disabled, onChange, onSelect }: { value: string; disabled: boolean; onChange: (value: string) => void; onSelect: (food: FoodCandidate) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!query.trim()) { setResults([]); setLoading(false); setError(''); return; }
    let active = true;
    setLoading(true); setResults([]); setError('');
    const timer = setTimeout(async () => {
      try { const response = await api.searchFoods(query.trim()); if (active) setResults(response.candidates.slice(0, 5)); }
      catch (err) { if (active) setError(err instanceof Error ? err.message : 'Food search unavailable. Try again.'); }
      finally { if (active) setLoading(false); }
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [query, retry]);
  return <div className="meal-name-search">
    <label className="meal-edit-field">Food name<input type="search" required maxLength={120} value={value} disabled={disabled} autoComplete="off" aria-describedby="meal-food-search-hint" onChange={event => { onChange(event.target.value); setQuery(event.target.value); }}/></label>
    <p id="meal-food-search-hint" className="meal-food-search-hint">Type to find matching foods. Selecting a name keeps your nutrition values for review.</p>
    {query.trim() && <section className="meal-food-suggestions" aria-label="Matching foods" aria-busy={loading}>
      {loading ? <p role="status">Searching foods…</p> : error ? <><p role="alert">{error}</p><button type="button" className="scan-retry" disabled={disabled} onClick={() => setRetry(value => value + 1)}>Try again</button></> : results.length ? <div className="food-result-list">{results.map(food => <button type="button" key={food.fdc_id} disabled={disabled} onClick={() => { onSelect(food); setQuery(''); setResults([]); }}><span><b>{food.description}</b><small>{food.data_type}</small></span></button>)}</div> : <p role="status">No matching foods. Try another name or keep your own.</p>}
    </section>}
  </div>;
}
