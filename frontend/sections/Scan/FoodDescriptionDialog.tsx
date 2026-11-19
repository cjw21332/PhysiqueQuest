'use client';
import { useEffect, useRef } from 'react';

export default function FoodDescriptionDialog({ value, onChange, onClose, onAnalyse }: { value: string; onChange: (value: string) => void; onClose: () => void; onAnalyse: (description: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); return () => { if (dialog.current?.open) dialog.current.close(); }; }, []);
  return <dialog ref={dialog} className="scan-description-dialog" aria-labelledby="food-description-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="scan-description-heading"><h2 id="food-description-title">Describe your food</h2><button type="button" onClick={onClose} aria-label="Close description">×</button></div>
    <p>Add any details that are hard to see in the photo.</p>
    <label htmlFor="food-description">Food description (optional)</label>
    <textarea id="food-description" autoFocus maxLength={2000} value={value} onChange={event => onChange(event.target.value)} placeholder="e.g. 1 cup rice, fried egg" aria-describedby="food-description-help" />
    <p id="food-description-help">Add portions, ingredients, or how it was cooked.</p>
    <div className="scan-description-actions"><button type="button" onClick={() => onAnalyse('')}>Skip &amp; Analyse</button><button type="button" className="primary" onClick={() => onAnalyse(value.trim())}>Analyse food</button></div>
  </dialog>;
}
