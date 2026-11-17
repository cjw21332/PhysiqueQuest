'use client';
import { titleCase } from '../../lib/titleCase';

import { useEffect, useRef, useState } from 'react';
import { api, SCAN_TIMEOUT_MS, type FoodCandidate, type FoodDetail, type ScanAnalysis, type ScannedItem } from '../../lib/api';
import { Icon } from '../Home/icons';
import { mealNames, type MealName } from './types';
import { scaleScannedItems } from './nutritionPresentation';
import OutcomeDialog from '../../components/OutcomeDialog';
import FoodNameSearch from './FoodNameSearch';
import './reviewEstimate.css';

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
  const [weights, setWeights] = useState<Record<number, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [dismissedError, setDismissedError] = useState(false);
  const [replacements, setReplacements] = useState<Record<number, ScannedItem>>({});
  const [added, setAdded] = useState<ScannedItem[]>([]);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftWeight, setDraftWeight] = useState('');
  const [draftDetail, setDraftDetail] = useState<FoodDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequest = useRef(0);
  const items = [...(analysis?.items ?? []).map((item, index) => replacements[index] ?? item), ...added];
  const saveable = items.map((item, index) => ({ item, index }));
  useEffect(() => { setExcluded([]); setWeights({}); setReplacements({}); setAdded([]); setEditing(null); detailRequest.current++; setPortion(1); setSaveError(''); }, [analysis]);
  useEffect(() => { if (status !== 'error') setDismissedError(false); }, [status]);
  useEffect(() => {
    if (status !== 'loading') { setElapsed(0); return; }
    const startedAt = Date.now(); setElapsed(0);
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [status]);
  const hint = WAITING_HINTS.filter(step => elapsed >= step.after).pop()?.text;
  const invalidWeight = saveable.some(({ item, index }) => !excluded.includes(index) && (weights[index] === '' || !Number.isFinite(Number(weights[index] ?? item.est_weight_g)) || Number(weights[index] ?? item.est_weight_g) < 1 || Number(weights[index] ?? item.est_weight_g) * portion > 5000));
  const included = scaleScannedItems(saveable.filter(({ index }) => !excluded.includes(index)).map(({ item, index }) => {
    const weight = weights[index] === undefined ? item.est_weight_g : Number(weights[index]);
    const base = item.found ? item : { ...item, kcal: null, protein_g: null, carbs_g: null, fat_g: null };
    return { ...scaleScannedItems([base], Number.isFinite(weight) && weight > 0 ? weight / item.est_weight_g : 1)[0], ...(weights[index] !== undefined ? { weight_corrected: true } : {}) };
  }), portion);
  const total = (key: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') => !included.length || included.some(item => item[key] == null) ? null : included.reduce((sum, item) => sum + item[key]!, 0);
  const totals = { kcal: total('kcal'), protein: total('protein_g'), carbs: total('carbs_g'), fat: total('fat_g') };
  const incomplete = Object.values(totals).some(value => value === null);
  const lowConfidence = items.filter(item => (!item.identification_method || item.identification_method === 'ai') && confidencePercent(item.confidence) < 75);
  const toggle = (index: number) => setExcluded(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index]);
  const openEditor = (index: number | 'new') => {
    detailRequest.current++; setDetailLoading(false); setDetailError(''); setDraftDetail(null);
    setDraftName(index === 'new' ? '' : items[index].food_name);
    setDraftWeight(index === 'new' ? '' : String(weights[index] ?? items[index].est_weight_g));
    setEditing(index);
  };
  const selectFood = async (food: FoodCandidate) => {
    const request = ++detailRequest.current;
    setDraftName(food.description.slice(0, 120)); setDraftDetail(null); setDetailError(''); setDetailLoading(true);
    try { const detail = await api.getFoodDetail(food.fdc_id); if (request === detailRequest.current) setDraftDetail(detail); }
    catch (err) { if (request === detailRequest.current) setDetailError(err instanceof Error ? err.message : 'Nutrition lookup failed.'); }
    finally { if (request === detailRequest.current) setDetailLoading(false); }
  };
  const applyEdit = () => {
    const weight = Number(draftWeight);
    if (editing === null || !draftName.trim() || !Number.isFinite(weight) || weight < 1 || weight > 5000 || detailLoading) return;
    const previous = editing === 'new' ? undefined : items[editing];
    const per = draftDetail?.per_100g;
    const item: ScannedItem = { food_name: draftName.trim(), est_weight_g: weight, confidence: previous?.confidence ?? 0,
      identification_method: editing === 'new' ? 'manual' : 'corrected', weight_corrected: editing === 'new' || !!previous?.weight_corrected || weights[editing as number] !== undefined || weight !== previous?.est_weight_g, found: !!draftDetail,
      ...(draftDetail ? { fdc_id: draftDetail.fdc_id, description: draftDetail.description, per_100g: draftDetail.per_100g } : {}),
      kcal: per?.kcal == null ? null : per.kcal * weight / 100, protein_g: per?.protein_g == null ? null : per.protein_g * weight / 100,
      carbs_g: per?.carbs_g == null ? null : per.carbs_g * weight / 100, fat_g: per?.fat_g == null ? null : per.fat_g * weight / 100 };
    if (editing === 'new') setAdded(current => [...current, item]);
    else {
      const originalCount = analysis?.items.length ?? 0;
      if (editing < originalCount) setReplacements(current => ({ ...current, [editing]: item }));
      else setAdded(current => current.map((entry, index) => index === editing - originalCount ? item : entry));
      setWeights(current => { const next = { ...current }; delete next[editing]; return next; });
    }
    setEditing(null);
  };
  const save = async () => {
    if (saving || !included.length || invalidWeight) return;
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
          {items.map((item, index) => <li key={index} className={`${item.found ? '' : 'unmatched'} ${excluded.includes(index) ? 'excluded' : ''}`}>
            <label><input className="visually-hidden" type="checkbox" aria-label={`Include ${titleCase(item.food_name)}`} checked={!excluded.includes(index)} onChange={() => toggle(index)}/><span className="detected-item-body"><b>{titleCase(item.food_name)}</b><small>{item.found ? (item.description || (preview ? 'Sample nutrition' : 'USDA FoodData Central')) : 'Nutrition unavailable; edit it after saving.'}</small></span>{!item.identification_method || item.identification_method === 'ai' ? <em className={confidencePercent(item.confidence) < 75 ? 'low' : ''} aria-label={`Identification confidence ${confidencePercent(item.confidence)} percent`}>{confidencePercent(item.confidence)}%</em> : <small>{item.identification_method === 'manual' ? 'Manually added' : 'Corrected'}</small>}</label>
            <div className="review-item-actions"><button type="button" onClick={() => openEditor(index)}>Change food</button><button type="button" onClick={() => toggle(index)}>{excluded.includes(index) ? 'Restore' : 'Exclude'}</button></div>
            <label className="review-item-weight">Estimated weight (g) <input type="number" min="1" max="5000" step="any" inputMode="decimal" value={weights[index] ?? item.est_weight_g} onChange={event => setWeights(current => ({ ...current, [index]: event.target.value }))} aria-label={`Estimated weight for ${item.food_name} in grams`}/></label>
            <small>{item.weight_corrected || weights[index] !== undefined ? 'Weight entered by you.' : 'Visual estimate; portion confidence and reliable range unavailable.'}</small>
            {item.found && <small>{preview ? 'Sample nutrition' : 'USDA FoodData Central'} · {(() => { const corrected = scaleScannedItems([item], (Number(weights[index] ?? item.est_weight_g) || item.est_weight_g) / item.est_weight_g * portion)[0]; return `${corrected.kcal == null ? '—' : Math.round(corrected.kcal)} kcal · ${corrected.carbs_g == null ? '—' : corrected.carbs_g.toFixed(1)} g carbs · ${corrected.protein_g == null ? '—' : corrected.protein_g.toFixed(1)} g protein · ${corrected.fat_g == null ? '—' : corrected.fat_g.toFixed(1)} g fat`; })()}</small>}
          </li>)}</ul>{analysis?.degraded && <p className="detected-degraded">Some nutrition lookups failed. These values may be incomplete.</p>}</div>}
        {status === 'ready' && <button type="button" onClick={() => openEditor('new')}>Add missing food</button>}
        {editing !== null && <section className="meal-edit" aria-label={editing === 'new' ? 'Add missing food' : 'Change food'}>
          <h3>{editing === 'new' ? 'Add missing food' : 'Change food'}</h3>
          <FoodNameSearch value={draftName} disabled={detailLoading} hint="Search and select a food to use its nutrition record." onChange={value => { detailRequest.current++; setDraftName(value); setDraftDetail(null); setDetailError(''); setDetailLoading(false); }} onSelect={food => void selectFood(food)}/>
          {detailLoading && <p role="status">Loading nutrition…</p>}
          {detailError && <p role="alert">{detailError}</p>}
          <p>{draftDetail ? `Selected: ${draftDetail.description} · USDA FoodData Central` : 'Choose a matching record, or keep this name with nutrition unavailable.'}</p>
          <label className="meal-edit-field">Weight (g)<input type="number" min="1" max="5000" step="any" value={draftWeight} onChange={event => setDraftWeight(event.target.value)} /></label>
          <button type="button" onClick={() => { detailRequest.current++; setEditing(null); }}>Cancel</button>
          <button type="button" disabled={detailLoading || !draftName.trim() || !draftWeight || !Number.isFinite(Number(draftWeight)) || Number(draftWeight) < 1 || Number(draftWeight) > 5000} onClick={applyEdit}>Use food</button>
        </section>}
      </div>
      {status === 'ready' && <div className="scan-warning"><Icon name="warning" size={20}/><p><strong>{lowConfidence.length ? `Low confidence on ${lowConfidence.length} item${lowConfidence.length > 1 ? 's' : ''}` : 'Review before saving'}</strong><br/>AI confidence is uncalibrated. Weights are visual estimates, not measurements; a reliable range is unavailable. Check each food and correct its grams. The portion multiplier applies to all items.</p></div>}
      <section className="scan-choice"><h3>Meal</h3><div className="scan-chips">{mealNames.map(option => <button type="button" key={option} aria-pressed={meal === option} className={meal === option ? 'active' : ''} onClick={() => setMeal(option)}>{option}</button>)}</div></section>
      <section className="scan-choice"><h3>Portion size</h3><div className="scan-chips portions">{portions.map(value => <button type="button" key={value} aria-pressed={portion === value} className={portion === value ? 'active' : ''} onClick={() => setPortion(value)}>{value}×</button>)}</div></section>
      {status === 'ready' && <section className="review-macros"><h3>Estimated macros for included foods</h3>{items.some(item => !item.found) && <p>Unmatched foods can be saved with nutrition marked unavailable.</p>}{included.length > 0 && incomplete && <p>Nutrition information is missing. Known values will be saved.</p>}<div className="estimated-macros">{([['Calories', totals.kcal, 'kcal'], ['Protein', totals.protein, 'g'], ['Carbohydrates', totals.carbs, 'g'], ['Fat', totals.fat, 'g']] as const).map(([label, value, unit]) => <div key={label}><span>{label}</span><span><b>{value === null ? 'Incomplete total' : Math.round(value)}</b> {value === null ? '' : unit}</span></div>)}</div></section>}
      {saveError && <p className="error" role="alert">{saveError}</p>}
      {invalidWeight && <p className="error" role="alert">Enter a weight between 1 and 5000 g for each included food.</p>}
    </div>
    <footer className="scan-footer split-footer review-estimate-footer"><button className="secondary" onClick={() => onAddManual(meal)}>Edit manually</button><button className="primary" disabled={saving || editing !== null || status !== 'ready' || !included.length || invalidWeight} onClick={()=>void save()}>{saving ? 'Saving…' : 'Save entry'}</button></footer>
    {status === 'error' && !dismissedError && <OutcomeDialog kind="error" title="Could not analyse this photo" message={error} actionLabel="Try again" onAction={onRetry} secondaryLabel="Retake photo" onSecondary={onRetake} onClose={() => setDismissedError(true)}/>}
  </div>;
}
