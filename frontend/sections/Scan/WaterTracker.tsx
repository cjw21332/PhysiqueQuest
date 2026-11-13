'use client';
import { useState } from 'react';
import { Icon } from '../Home/icons';

export default function WaterTracker({ water, onWater }: { water: number; onWater: (value: number) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = async (value: number) => {
    if (busy || value < 0 || value > 30) return;
    setBusy(true); setError('');
    try { await onWater(value); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update water. Try again.'); }
    finally { setBusy(false); }
  };
  return <section className="water-tracker" aria-labelledby="water-tracker-title"><div className="water-tracker-head"><span className="water-tracker-icon"><Icon name="water" size={20}/></span><div><h3 id="water-tracker-title">Water intake</h3><p>Today · {water >= 8 ? 'Daily goal reached' : `${8 - water} more to reach 8`}</p></div><strong aria-live="polite">{water}<small> / 8 glasses</small></strong></div>
    <div className="water-tracker-progress" role="progressbar" aria-label="Water intake toward eight glasses" aria-valuemin={0} aria-valuemax={8} aria-valuenow={Math.min(8, water)} aria-valuetext={`${water} of 8 glasses`}><span style={{ width: `${Math.min(100, water / 8 * 100)}%` }}/></div>
    <div className="water-tracker-actions"><button type="button" disabled={busy || water <= 0} aria-label="Remove one glass of water" onClick={() => void change(water - 1)}><Icon name="minus" size={18}/></button><span>{busy ? 'Saving…' : 'Track by the glass'}</span><button type="button" disabled={busy || water >= 30} aria-label="Add one glass of water" onClick={() => void change(water + 1)}><Icon name="plus" size={18}/> Add glass</button></div>
    {error && <p role="alert" className="water-tracker-error">{error}</p>}
  </section>;
}
