'use client';

import { useEffect, useState } from 'react';
import type { ScanAnalysis, ScannedItem } from '../../lib/api';
import { SCAN_TIMEOUT_MS } from '../../lib/api';
import { Icon } from '../Home/icons';
import { mealNames, type MealName } from './types';

type ScanStatus = 'loading' | 'ready' | 'error';

/**
 * Reassurance shown while a scan is outstanding. A silent spinner reads as a
 * frozen app once a request runs past a few seconds, so we say what is being
 * waited on, how long it has been, and when the app will stop waiting. The
 * steps are spaced across the cap rather than bunched at the start, otherwise a
 * long wait goes quiet just when the user is most likely to give up.
 */
const WAITING_HINTS = [
  { after: 10, text: 'Still working. Identifying each item and matching nutrition records can take a while.' },
  { after: 25, text: 'Still working. Complex photos with several items take longer than simple ones.' },
  { after: 45, text: `Still working. We stop waiting at ${SCAN_TIMEOUT_MS / 1000} seconds and you can try again.` },
];

export default function ReviewEstimate({
  imageUrl,
  status,
  analysis,
  error,
  onBack,
  onRetake,
  onRetry,
  onAddManual,
  onSave,
}: {
  imageUrl: string;
  status: ScanStatus;
  analysis: ScanAnalysis | null;
  error: string;
  onBack: () => void;
  onRetake: () => void;
  onRetry: () => void;
  onAddManual: (meal: MealName) => void;
  onSave: (meal: MealName, items: ScannedItem[]) => void;
}) {
  const [meal, setMeal] = useState<MealName>('Dinner');
  const items = analysis?.items ?? [];
  // Only matched items can be saved; the backend skips the rest rather than
  // storing a zero-calorie row, so they start excluded and stay unselectable.
  const saveable = items.map((item, index) => ({ item, index })).filter(({ item }) => item.found);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);

  // A fresh analysis replaces the previous one, so the old exclusions must not
  // carry over and silently drop items the user never saw.
  useEffect(() => { setExcluded([]); }, [analysis]);

  // Elapsed time for the current attempt. Keying on `status` resets the count
  // when a retry starts and stops the interval as soon as a result lands.
  useEffect(() => {
    if (status !== 'loading') { setElapsed(0); return; }
    const startedAt = Date.now();
    setElapsed(0);
    const id = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    );
    return () => window.clearInterval(id);
  }, [status]);

  const hint = WAITING_HINTS.filter(step => elapsed >= step.after).pop()?.text;

  const included = saveable.filter(({ index }) => !excluded.includes(index)).map(({ item }) => item);
  const toggle = (index: number) => setExcluded(current =>
    current.includes(index) ? current.filter(value => value !== index) : [...current, index]);

  return <>
    <header className="scan-header">
      <div className="section-back-title">
        <button className="coach-back" onClick={onBack} aria-label="Back to Nutrition"><Icon name="arrow" size={24}/></button>
        <h2>Review photo</h2>
      </div>
      <button onClick={onRetake}><Icon name="scan" size={13}/> Retake</button>
    </header>

    <div className="detected-foods">
      <div className="meal-photo">
        {imageUrl && <img src={imageUrl} alt="Meal photo being analysed"/>}
        <span><Icon name="meal" size={20}/></span>
      </div>

      {status === 'loading' && <div className="detected-list" role="status">
        <b>Analysing photo</b>
        <p>Looking for food and matching nutrition records…</p>
        {/* The counter is decorative for assistive tech: announcing it every
            second would flood the live region, so only the surrounding prose
            is read out. */}
        <p className="scan-waiting" aria-hidden="true">
          <span className="scan-spinner" />
          <span>Waiting for the result · {elapsed}s</span>
        </p>
        {hint && <p className="scan-hint">{hint}</p>}
        <div className="scan-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, (elapsed / (SCAN_TIMEOUT_MS / 1000)) * 100)}%` }}/></div>
      </div>}

      {status === 'error' && <div className="detected-list" role="alert">
        <b>Could not analyse this photo</b>
        <p>{error}</p>
        <button className="scan-retry" onClick={onRetry}>Try again</button>
      </div>}

      {status === 'ready' && !items.length && <div className="detected-list">
        <b>No food recognised</b>
        <p>Nothing recognisable was found in this photo. Try a clearer shot, or enter the meal manually.</p>
      </div>}

      {status === 'ready' && !!items.length && <div className="detected-list">
        <b>Detected items</b>
        <p>{saveable.length} of {items.length} matched a nutrition record.</p>
        <ul className="detected-items">
          {items.map((item, index) => {
            const isExcluded = excluded.includes(index);
            return <li key={`${item.food_name}-${index}`} className={item.found ? (isExcluded ? 'excluded' : '') : 'unmatched'}>
              {item.found
                ? <label>
                    <input type="checkbox" checked={!isExcluded} onChange={() => toggle(index)}/>
                    <span className="detected-item-body">
                      <b>{item.food_name}</b>
                      <small>{item.description || `about ${Math.round(item.est_weight_g)} g`}</small>
                      <small className="detected-item-macros">
                        {item.kcal.toFixed(1)} kcal · P {item.protein_g.toFixed(1)} g · C {item.carbs_g.toFixed(1)} g · F {item.fat_g.toFixed(1)} g
                      </small>
                    </span>
                  </label>
                : <span className="detected-item-body">
                    <b>{item.food_name}</b>
                    <small>No nutrition record matched, so this cannot be logged.</small>
                  </span>}
            </li>;
          })}
        </ul>
        {analysis?.degraded && <p className="detected-degraded">Some nutrition lookups failed, so these values may be incomplete.</p>}
        <p className="detected-totals">
          Selected total: {included.reduce((sum, item) => sum + item.kcal, 0).toFixed(1)} kcal
        </p>
      </div>}
    </div>

    {status === 'ready' && <div className="scan-warning">
      <b>!</b>
      <p><strong>Review before saving</strong><br/>Drop anything that was misidentified, then check the portions look right.</p>
    </div>}

    <section className="scan-choice">
      <h3>Meal to log</h3>
      <div className="scan-chips">
        {mealNames.map(option => <button key={option} className={meal === option ? 'active' : ''} onClick={() => setMeal(option)}>{option}</button>)}
      </div>
    </section>

    <footer className="scan-footer">
      {status === 'ready' && <button className="primary" disabled={!included.length} onClick={() => onSave(meal, included)}>
        {included.length ? `Add ${included.length} item${included.length > 1 ? 's' : ''} to ${meal}` : 'Nothing selected'}
      </button>}
      <button className="secondary" onClick={() => onAddManual(meal)}>Enter meal manually</button>
    </footer>
  </>;
}
