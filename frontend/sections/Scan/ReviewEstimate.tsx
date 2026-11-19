'use client';
import { titleCase } from '../../lib/titleCase';

import { useEffect, useRef, useState } from 'react';
import { api, SCAN_TIMEOUT_MS, type FoodCandidate, type FoodDetail, type ScanAnalysis, type ScannedItem } from '../../lib/api';
import { Icon } from '../Home/icons';
import { mealNames, type MealName } from './types';
import { defaultMeal } from './defaultMeal';
import { scaleScannedItems } from './nutritionPresentation';
import OutcomeDialog from '../../components/OutcomeDialog';
import FoodNameSearch from './FoodNameSearch';
import './reviewEstimate.css';

const WAITING_HINTS = [
  { after: 10, text: 'Identifying your food…' },
  { after: 25, text: 'Still analysing. Your photo is safe to review when it is ready.' },
  { after: 45, text: `Still working. We stop waiting at ${SCAN_TIMEOUT_MS / 1000} seconds and you can try again.` },
];
const portions = [.5, 1, 1.5, 2];
const massUnits = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 } as const;
type MassUnit = keyof typeof massUnits;

export default function ReviewEstimate({ imageUrl, status, analysis, error, onBack, onRetake, onRetry, onAddManual, onSave, preview = false }: {
  imageUrl: string; status: 'loading' | 'ready' | 'error'; analysis: ScanAnalysis | null; error: string;
  onBack: () => void; onRetake: () => void; onRetry: () => void; onAddManual: (meal: MealName) => void;
  onSave: (meal: MealName, items: ScannedItem[]) => void | Promise<void>; preview?: boolean;
}) {
  const [meal, setMeal] = useState<MealName>(defaultMeal);
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
  const [draftUnit, setDraftUnit] = useState<MassUnit>('g');
  const [draftPreparation, setDraftPreparation] = useState('');
  const [draftOil, setDraftOil] = useState('');
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
  const invalidWeight = saveable.some(({ item, index }) => !excluded.includes(index) && (weights[index] === '' || !Number.isFinite(Number(weights[index] ?? item.est_weight_g)) || Number(weights[index] ?? item.est_weight_g) < 1 || Number(weights[index] ?? item.est_weight_g) * portion < 1 || Number(weights[index] ?? item.est_weight_g) * portion > 5000));
  const included = scaleScannedItems(saveable.filter(({ index }) => !excluded.includes(index)).map(({ item, index }) => {
    const weight = weights[index] === undefined ? item.est_weight_g : Number(weights[index]);
    const base = item.found ? item : { ...item, kcal: null, protein_g: null, carbs_g: null, fat_g: null };
    const corrected = weights[index] !== undefined || portion !== 1;
    const scaled = scaleScannedItems([base], Number.isFinite(weight) && weight > 0 ? weight / item.est_weight_g : 1)[0];
    if (weights[index] !== undefined || portion !== 1) { delete scaled.entered_quantity; delete scaled.entered_unit; }
    return { ...scaled, ...(corrected ? { weight_corrected: true, evidence: { name: item.evidence?.name ?? 'unknown', quantity: 'user_confirmed' as const, preparation: item.evidence?.preparation ?? 'unknown', added_oil: item.evidence?.added_oil ?? 'unknown' } } : {}) };
  }), portion);
  const total = (key: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') => !included.length || included.some(item => item[key] == null) ? null : included.reduce((sum, item) => sum + item[key]!, 0);
  const knownTotal = (key: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') => {
    const values = included.map(item => item[key]).filter((value): value is number => value !== null && Number.isFinite(value));
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  };
  const totals = { kcal: total('kcal'), protein: total('protein_g'), carbs: total('carbs_g'), fat: total('fat_g') };
  const incomplete = Object.values(totals).some(value => value === null);
  const toggle = (index: number) => setExcluded(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index]);
  const openEditor = (index: number | 'new') => {
    detailRequest.current++; setDetailLoading(false); setDetailError(''); setDraftDetail(null);
    setDraftName(index === 'new' ? '' : items[index].food_name);
    const item = index === 'new' ? undefined : items[index];
    const priorUnit = index !== 'new' && weights[index] === undefined ? item?.entered_unit : undefined;
    setDraftUnit(priorUnit ?? 'g');
    setDraftWeight(index === 'new' ? '' : String(priorUnit && item?.entered_quantity !== undefined ? item.entered_quantity : weights[index] ?? item!.est_weight_g));
    setDraftPreparation(index === 'new' ? '' : items[index].preparation_correction ?? '');
    setDraftOil(index === 'new' ? '' : items[index].added_oil_correction ?? '');
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
    const weight = Number(draftWeight) * massUnits[draftUnit];
    if (editing === null || !draftName.trim() || !Number.isFinite(weight) || weight < 1 || weight > 5000 || detailLoading) return;
    const previous = editing === 'new' ? undefined : items[editing];
    const nameChanged = !previous || draftName.trim() !== previous.food_name;
    const weightChanged = !previous || !!previous.weight_corrected || weights[editing as number] !== undefined || weight !== previous.est_weight_g;
    const preserveMatch = !!previous && !nameChanged && !draftDetail;
    const per = draftDetail?.per_100g ?? (preserveMatch ? previous?.per_100g : undefined);
    const preparation = draftPreparation.trim();
    const oil = draftOil.trim();
    const item: ScannedItem = { food_name: draftName.trim(), est_weight_g: weight, confidence: previous?.confidence ?? 0,
      entered_quantity: Number(draftWeight), entered_unit: draftUnit,
      ...(previous?.evidence_ref ? { evidence_ref: previous.evidence_ref } : {}),
      ...(preparation ? { preparation_correction: preparation } : {}), ...(oil ? { added_oil_correction: oil } : {}),
      identification_method: editing === 'new' ? 'manual' : nameChanged ? 'corrected' : previous?.identification_method ?? 'ai', weight_corrected: weightChanged, found: !!draftDetail || (preserveMatch && !!previous?.found),
      evidence: { name: nameChanged ? 'user_confirmed' : previous?.evidence?.name ?? 'unknown', quantity: weightChanged ? 'user_confirmed' : previous?.evidence?.quantity ?? 'unknown', preparation: preparation ? 'user_confirmed' : previous?.evidence?.preparation ?? 'unknown', added_oil: oil ? 'user_confirmed' : previous?.evidence?.added_oil ?? 'unknown' },
      ...(draftDetail ? { fdc_id: draftDetail.fdc_id, description: draftDetail.description, per_100g: draftDetail.per_100g } : preserveMatch ? { fdc_id: previous?.fdc_id, nutrition_ref: previous?.nutrition_ref, nutrition_source: previous?.nutrition_source, description: previous?.description, per_100g: previous?.per_100g } : {}),
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
      <div className="section-back-title pq-page-heading"><button className="coach-back" onClick={onBack} aria-label="Back to Nutrition"><Icon name="arrow" size={20}/></button><h2>Review your meal</h2></div>
      <button type="button" onClick={onRetake}><Icon name="retake" size={15}/> Retake</button>
    </header>
    <div className="review-estimate-content">
      <div className="detected-foods">
        <div className={`meal-photo ${preview ? 'meal-photo-reference' : ''}`}>
          {imageUrl ? <img src={imageUrl} alt="Meal photo for review"/> : <Icon name="image" size={24}/>}
          
        </div>
        {status === 'loading' && <div className="detected-list review-loading" role="status"><span className="review-status-icon" aria-hidden="true"><Icon name="scan" size={22}/></span><div><h3>Analysing your meal</h3><p>Identifying foods and matching nutrition records…</p><p className="scan-waiting" aria-hidden="true"><span className="scan-spinner"/><span>Waiting for the result · {elapsed}s</span></p>{hint && <p className="scan-hint">{hint}</p>}<div className="scan-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, elapsed / (SCAN_TIMEOUT_MS / 1000) * 100)}%` }}/></div></div></div>}
        {status === 'error' && <div className="detected-list" role="alert"><b>Could not analyse this photo</b><p>{error}</p><button className="scan-retry" onClick={onRetry}>Try again</button></div>}
        {status === 'ready' && !items.length && <div className="detected-list"><b>No food recognised</b><p>Try a clearer shot, or enter the meal manually.</p></div>}
        {status === 'ready' && !!items.length && <div className="detected-list"><div className="review-items-heading"><div><h3>Foods in your meal</h3><p>Check the foods and adjust their amounts.</p></div><span>{included.length} included</span></div><ul className="detected-items">
          {items.map((item, index) => <li key={index} className={`${item.found ? '' : 'unmatched'} ${excluded.includes(index) ? 'excluded' : ''}`}>
            <div className="review-item-heading"><span className="detected-item-body"><b>{titleCase(item.food_name)}</b><small>{item.found ? (item.description || item.food_name) : 'Nutrition unavailable'}</small></span></div>
            <div className="review-item-actions"><button type="button" onClick={() => openEditor(index)}><Icon name="edit" size={15}/> Change food</button><button type="button" onClick={() => toggle(index)}><Icon name={excluded.includes(index) ? 'plus' : 'minus-circle'} size={15}/> {excluded.includes(index) ? 'Restore' : 'Exclude'}</button></div>
            <label className="review-item-weight">Estimated weight (g) <input type="number" min="1" max="5000" step="any" inputMode="decimal" value={weights[index] ?? item.est_weight_g} onChange={event => setWeights(current => ({ ...current, [index]: event.target.value }))} aria-label={`Estimated weight for ${item.food_name} in grams`}/></label>
            {item.found && <details className="review-source"><summary>Nutrition details</summary><p>{(() => { const corrected = scaleScannedItems([item], (Number(weights[index] ?? item.est_weight_g) || item.est_weight_g) / item.est_weight_g * portion)[0]; return `${corrected.kcal == null ? '—' : Math.round(corrected.kcal)} kcal · ${corrected.protein_g == null ? '—' : corrected.protein_g.toFixed(1)} g protein · ${corrected.carbs_g == null ? '—' : corrected.carbs_g.toFixed(1)} g carbs · ${corrected.fat_g == null ? '—' : corrected.fat_g.toFixed(1)} g fat`; })()}</p></details>}
          </li>)}</ul>{analysis?.degraded && <p className="detected-degraded">Some nutrition lookups failed. These values may be incomplete.</p>}</div>}
        {status === 'ready' && <button type="button" className="review-add-food" onClick={() => openEditor('new')}><Icon name="plus" size={17}/> Add missing food</button>}
        {editing !== null && <section className="meal-edit" aria-label={editing === 'new' ? 'Add missing food' : 'Change food'}>
          <h3>{editing === 'new' ? 'Add missing food' : 'Change food'}</h3>
          <FoodNameSearch value={draftName} disabled={detailLoading} hint="Search and select a food to use its nutrition record." onChange={value => { detailRequest.current++; setDraftName(value); setDraftDetail(null); setDetailError(''); setDetailLoading(false); }} onSelect={food => void selectFood(food)}/>
          {detailLoading && <p role="status">Loading nutrition…</p>}
          {detailError && <p role="alert">{detailError}</p>}
          <p>{draftDetail ? `Selected: ${draftDetail.description}` : 'Choose a matching record, or keep this name with nutrition unavailable.'}</p>
          <label className="meal-edit-field">Quantity<input type="number" min="0.000001" step="any" value={draftWeight} onChange={event => setDraftWeight(event.target.value)} /></label>
          <label className="meal-edit-field">Mass unit<select value={draftUnit} onChange={event => { const next = event.target.value as MassUnit; const grams = Number(draftWeight) * massUnits[draftUnit]; setDraftUnit(next); if (Number.isFinite(grams) && grams > 0) setDraftWeight(String(Number((grams / massUnits[next]).toFixed(6)))); }}>{Object.keys(massUnits).map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label>
          <p>Equivalent weight: {Number.isFinite(Number(draftWeight) * massUnits[draftUnit]) ? (Number(draftWeight) * massUnits[draftUnit]).toFixed(1) : '—'} g. Household measures require a food-specific serving weight.</p>
          <label className="meal-edit-field">Preparation (optional)<input type="text" maxLength={120} value={draftPreparation} onChange={event => setDraftPreparation(event.target.value)} placeholder="For example, grilled" /></label>
          <label className="meal-edit-field">Added oil or cooking fat (optional)<input type="text" maxLength={200} value={draftOil} onChange={event => setDraftOil(event.target.value)} placeholder="For example, 1 tsp olive oil or no added oil" /></label>
          <p>These notes do not change nutrition automatically. Choose a matching food or add oil as a separate item if needed.</p>
          <button type="button" onClick={() => { detailRequest.current++; setEditing(null); }}>Cancel</button>
          <button type="button" disabled={detailLoading || !draftName.trim() || !draftWeight || !Number.isFinite(Number(draftWeight)) || Number(draftWeight) * massUnits[draftUnit] < 1 || Number(draftWeight) * massUnits[draftUnit] > 5000} onClick={applyEdit}>Use food</button>
        </section>}
      </div>
      {status === 'ready' && items.length > 0 && <p className="review-estimate-note">Food and portion sizes are estimates. Check them before saving.</p>}
      <section className="scan-choice"><h3>Meal</h3><div className="scan-chips">{mealNames.map(option => <button type="button" key={option} aria-pressed={meal === option} className={meal === option ? 'active' : ''} onClick={() => setMeal(option)}>{option}</button>)}</div></section>
      <section className="scan-choice"><h3>Portion size</h3><p className="review-portion-note">Applies to all included foods</p><div className="scan-chips portions">{portions.map(value => <button type="button" key={value} aria-pressed={portion === value} className={portion === value ? 'active' : ''} onClick={() => setPortion(value)}>{value}×</button>)}</div></section>
      {status === 'ready' && <section className="review-macros"><h3>Meal nutrition</h3>{included.length > 0 && incomplete && <p>Some foods have no nutrition match. Totals show known values only.</p>}<div className="estimated-macros">{([['Calories', totals.kcal, 'kcal', 'kcal'], ['Protein', totals.protein, 'g', 'protein_g'], ['Carbohydrates', totals.carbs, 'g', 'carbs_g'], ['Fat', totals.fat, 'g', 'fat_g']] as const).map(([label, value, unit, key]) => { const known = value === null ? knownTotal(key) : null; return <div key={label}><span>{label}</span><span><b>{value !== null ? `${Math.round(value)} ${unit}` : known !== null ? `${Math.round(known)} ${unit} known` : 'Unavailable'}</b>{value === null && known !== null && <small> · Incomplete</small>}</span></div>; })}</div></section>}
      {saveError && <p className="error" role="alert">{saveError}</p>}
      {invalidWeight && <p className="error" role="alert">Enter a weight between 1 and 5000 g for each included food.</p>}
    </div>
    <footer className="scan-footer split-footer review-estimate-footer"><button className="secondary" onClick={() => onAddManual(meal)}>Add manually</button><button className="primary" disabled={saving || editing !== null || status !== 'ready' || !included.length || invalidWeight} onClick={()=>void save()}>{saving ? 'Saving…' : 'Save meal'}</button></footer>
    {status === 'error' && !dismissedError && <OutcomeDialog kind="error" title="Could not analyse this photo" message={error} actionLabel="Try again" onAction={onRetry} secondaryLabel="Retake photo" onSecondary={onRetake} onClose={() => setDismissedError(true)}/>}
  </div>;
}
