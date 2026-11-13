'use client';
import { useEffect, useRef, useState } from 'react';
import type { Profile } from '../sections/Home/types';
import { api } from '../lib/api';
import { recordWeightChange } from '../lib/weightUpdate';

export default function WeightModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (message: string, weight: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(profile.weight || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); return () => { dialog.current?.close(); }; }, []);
  const save = async () => {
    const weight = Number(value), kg = profile.weightUnit === 'lbs' || profile.weightUnit === 'lb' ? weight * 0.45359237 : weight;
    if (!Number.isFinite(kg) || kg < 25 || kg > 350) { setError('Enter a weight between 25 and 350 kg, or its equivalent.'); return; }
    setBusy(true); setError('');
    try {
      const updated = await api.updateProfile({ weight: value });
      try { onSaved(await recordWeightChange({ ...profile, ...updated, weight: value }), value); }
      catch { onSaved('Weight saved to your profile, but history or calorie targets could not be updated. Check your connection.', value); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save your weight.'); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="weight-modal" aria-labelledby="weight-modal-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}><h2 id="weight-modal-title">Update your weight</h2><p>For consistent readings, use the same scale on a firm floor, ideally in the morning after using the toilet and before food or drink. Wear similar light clothing each time.</p><p>Day-to-day weight can fluctuate; look at the trend over time. <a href="https://elht.nhs.uk/services/dietetics/body-measuring-techniques" target="_blank" rel="noreferrer">Weighing guidance</a></p><label>Current weight ({profile.weightUnit || 'kg'})<input type="number" inputMode="decimal" step="0.1" min="0" value={value} onChange={e => setValue(e.target.value)} autoFocus/></label>{error && <p role="alert">{error}</p>}<div><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="button" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save weight'}</button></div></dialog>;
}
