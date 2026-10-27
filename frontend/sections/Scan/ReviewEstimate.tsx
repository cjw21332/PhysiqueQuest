'use client';
import { titleCase } from '../../lib/titleCase';

import { useEffect, useState } from 'react';
import { SCAN_TIMEOUT_MS, type ScanAnalysis, type ScannedItem } from '../../lib/api';
import { Icon } from '../Home/icons';
import { mealNames, type MealName } from './types';
import { scaleScannedItems } from './nutritionPresentation';

const WAITING_HINTS = [
  { after: 10, text: 'Still working. Identifying each item and matching nutrition records can take a while.' },
  { after: 25, text: 'Still working. Complex photos with several items take longer than simple ones.' },
  { after: 45, text: `Still working. We stop waiting at ${SCAN_TIMEOUT_MS / 1000} seconds and you can try again.` },
];
const portions = [.5, 1, 1.5, 2];
const confidencePercent = (value: number) => Math.round(value <= 1 ? value * 100 : value);

export default function ReviewEstimate({ imageUrl, status, analysis, error, onBack, onRetake, onRetry, onAddManual, onSave, preview = false }: {
  imageUrl: string; status: 'loading' | 'ready' | 'error'; analysis: ScanAnalysis | null; error: string;
  onBack: () => void; onRetake: () => void; onRetry: () => void; onAddManual: (meal: MealName) => void;
  onSave: (meal: MealName, items: ScannedItem[]) => void | Promise<void>; preview?: boolean;
}) {
  const [meal, setMeal] = useState<MealName>('Dinner');
  const [portion, setPortion] = useState(1);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const items = analysis?.items ?? [];
  const saveable = items.map((item, index) => ({ item, index })).filter(({ item }) => item.found);
  useEffect(() => { setExcluded([]); setPortion(1); setSaveError(''); }, [analysis]);
  useEffect(() => {
    if (status !== 'loading') { setElapsed(0); return; }
    const startedAt = Date.now(); setElapsed(0);
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [status]);
  const hint = WAITING_HINTS.filter(step => elapsed >= step.after).pop()?.text;
  const included = scaleScannedItems(saveable.filter(({ index }) => !excluded.includes(index)).map(({ item }) => item), portion);
  const totals = included.reduce((sum, item) => ({ kcal: sum.kcal + item.kcal, protein: sum.protein + item.protein_g, carbs: sum.carbs + item.carbs_g, fat: sum.fat + item.fat_g }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const lowConfidence = items.filter(item => confidencePercent(item.confidence) < 75);
  const toggle = (index: number) => setExcluded(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index]);
  const save = async () => {
    if (saving || !included.length) return;
    setSaving(true); setSaveError('');
    try { await onSave(meal, included); }
    catch (err) { setSaveError(err instanceof Error ? err.message : 'Could not save the entry. Try again.'); }
    finally { setSaving(false); }
  };
  return <div className="review-estimate-screen">
    <header className="scan-header review-estimate-header">
      <div className="section-back-title"><button className="coach-back" onClick={onBack} aria-label="Back to Nutrition"><Icon name="arrow" size={20}/></button><h2>Review estimate</h2></div>
      <button type="button" onClick={onRetake}><Icon name="retake" size={15}/> Retake</button>
    </header>
    <div className="review-estimate-content">
      <div className="detected-foods">
        <div className={`meal-photo ${preview ? 'meal-photo-reference' : ''}`}>
          {imageUrl ? <img src={imageUrl} alt="Meal photo being analysed"/> : <Icon name="meal" size={24}/>}
        </div>
        {status === 'loading' && <div className="detected-list" role="status"><b>Analysing photo</b><p>Looking for food and matching nutrition records…</p><p className="scan-waiting" aria-hidden="true"><span className="scan-spinner"/><span>Waiting for the result · {elapsed}s</span></p>{hint && <p className="scan-hint">{hint}</p>}<div className="scan-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, elapsed / (SCAN_TIMEOUT_MS / 1000) * 100)}%` }}/></div></div>}
        {status === 'error' && <div className="detected-list" role="alert"><b>Could not analyse this photo</b><p>{error}</p><button className="scan-retry" onClick={onRetry}>Try again</button></div>}
        {status === 'ready' && !items.length && <div className="detected-list"><b>No food recognised</b><p>Try a clearer shot, or enter the meal manually.</p></div>}
        {status === 'ready' && !!items.length && <div className="detected-list"><b>Detected items</b><ul className="detected-items">
          {items.map((item, index) => <li key={`${titleCase(item.food_name)}-${index}`} className={item.found ? (excluded.includes(index) ? 'excluded' : '') : 'unmatched'}>
            {item.found ? <label><input className="visually-hidden" type="checkbox" aria-label={`Include ${titleCase(item.food_name)}`} checked={!excluded.includes(index)} onChange={() => toggle(index)}/><span className="detected-item-body"><b>{titleCase(item.food_name)}</b><small>{preview && item.description && portion === 1 ? item.description : `${Math.round(item.est_weight_g * portion)} g`}</small></span><em className={confidencePercent(item.confidence) < 75 ? 'low' : ''}>{confidencePercent(item.confidence)}</em></label> : <span className="detected-item-body"><b>{titleCase(item.food_name)}</b><small>No nutrition record matched; this item cannot be saved.</small></span>}
          </li>)}</ul>{analysis?.degraded && <p className="detected-degraded">Some nutrition lookups failed. These values may be incomplete.</p>}</div>}
      </div>
      {status === 'ready' && <div className="scan-warning"><Icon name="warning" size={20}/><p><strong>{lowConfidence.length ? `Low confidence on ${lowConfidence.length} item${lowConfidence.length > 1 ? 's' : ''}` : 'Review before saving'}</strong><br/>{lowConfidence.length ? `Check “${lowConfidence.map(item => item.food_name).join('”, “')}” before saving, or edit the values manually.` : 'Check the identified foods and portions. Tap an item to exclude it.'}</p></div>}
      <section className="scan-choice"><h3>Meal</h3><div className="scan-chips">{mealNames.map(option => <button type="button" key={option} aria-pressed={meal === option} className={meal === option ? 'active' : ''} onClick={() => setMeal(option)}>{option}</button>)}</div></section>
      <section className="scan-choice"><h3>Portion size</h3><div className="scan-chips portions">{portions.map(value => <button type="button" key={value} aria-pressed={portion === value} className={portion === value ? 'active' : ''} onClick={() => setPortion(value)}>{value}×</button>)}</div></section>
      {status === 'ready' && <section className="review-macros"><h3>Estimated macros</h3><div className="estimated-macros">{[['Calories', totals.kcal, 'kcal'], ['Protein', totals.protein, 'g'], ['Carbohydrates', totals.carbs, 'g'], ['Fat', totals.fat, 'g']].map(([label, value, unit]) => <div key={label}><span>{label}</span><span><b>{Math.round(Number(value))}</b> {unit}</span></div>)}</div></section>}
      {saveError && <p className="error" role="alert">{saveError}</p>}
    </div>
    <footer className="scan-footer split-footer review-estimate-footer"><button className="secondary" onClick={() => onAddManual(meal)}>Edit manually</button><button className="primary" disabled={saving || status !== 'ready' || !included.length} onClick={()=>void save()}>{saving ? 'Saving…' : 'Save entry'}</button></footer>
  </div>;
}
