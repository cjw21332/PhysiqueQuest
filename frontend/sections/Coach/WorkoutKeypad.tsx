'use client';
import { Icon } from '../Home/icons';

import { useEffect, useRef, useState } from 'react';

export default function WorkoutKeypad({ field, value, unit, onApply, onClose }: {
  field: 'weight' | 'reps'; value: string; unit: 'kg' | 'lbs';
  onApply: (value: string, unit: 'kg' | 'lbs') => void; onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const [text, setText] = useState(value);
  const [selectedUnit, setSelectedUnit] = useState(unit);
  const [replace, setReplace] = useState(true);
  const [error, setError] = useState('');
  // Keep the last entered value as the conversion source so switching units
  // repeatedly does not compound display rounding.
  const conversionSource = useRef<{ text: string; unit: 'kg' | 'lbs' }>({ text: value, unit });
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  const enter = (key: string) => {
    setError('');
    if (key === 'Backspace') { const next = text.slice(0, -1); setText(next); conversionSource.current = { text: next, unit: selectedUnit }; setReplace(false); return; }
    if (!/^\d$/.test(key) && !(key === '.' && field === 'weight')) return;
    const candidate = (replace ? '' : text) + key;
    const next = candidate.length <= 8 && /^\d*(\.\d*)?$/.test(candidate) ? (candidate === '.' ? '0.' : candidate) : text;
    setText(next);
    conversionSource.current = { text: next, unit: selectedUnit };
    setReplace(false);
  };
  const apply = () => {
    const number = Number(text);
    if (field === 'weight' && text === '') { onApply('', selectedUnit); onClose(); return; }
    if (field === 'reps' ? !text || !Number.isInteger(number) || number < 1 || number > 1000 : !Number.isFinite(number) || number < 0 || number > (selectedUnit === 'kg' ? 1000 : 2204.62)) {
      setError(field === 'reps' ? 'Enter 1–1000 whole reps.' : 'Enter a weight up to 1000 kg / 2204.62 lbs.'); return;
    }
    onApply(text, selectedUnit); onClose();
  };
  return <section ref={panel} tabIndex={-1} className="workout-keypad" aria-labelledby="keypad-title" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key === 'Enter' && event.target === panel.current) { event.preventDefault(); apply(); return; }
    if (/^\d$/.test(event.key) || event.key === '.' || event.key === ',' || event.key === 'Backspace') { event.preventDefault(); enter(event.key === ',' ? '.' : event.key); }
  }}>
    <header><h2 id="keypad-title">{field === 'weight' ? 'Weight' : 'Reps'}</h2><button type="button" onClick={onClose} aria-label="Close keypad">×</button></header>
    <output aria-live="polite">{text || '—'} <small>{field === 'weight' ? selectedUnit : 'reps'}</small></output>
    {field === 'weight' && <div className="keypad-units" role="group" aria-label="Weight unit">{(['lbs', 'kg'] as const).map(next => <button key={next} type="button" aria-pressed={selectedUnit === next} onClick={() => {
      if (next === selectedUnit) return;
      const source = conversionSource.current;
      if (source.text !== '') setText(next === source.unit ? source.text : String(Math.round(Number(source.text) * (next === 'lbs' ? 2.2046226218 : 1 / 2.2046226218) * 100) / 100));
      setError(''); setSelectedUnit(next); setReplace(true);
    }}>{next}</button>)}</div>}
    <div className="keypad-digits">{['1','2','3','4','5','6','7','8','9',field === 'weight' ? '.' : '', '0','Backspace'].map((key, index) => <button key={index} type="button" disabled={!key} aria-label={key === 'Backspace' ? 'Delete last digit' : key === '.' ? 'Decimal point' : key || 'Unused key'} onClick={() => enter(key)}>{key === 'Backspace' ? <Icon name="backspace" size={22}/> : key}</button>)}</div>
    {error && <p role="alert">{error}</p>}
    <footer><button type="button" onClick={() => { setText(''); conversionSource.current = { text: '', unit: selectedUnit }; setError(''); setReplace(false); }}>Clear</button><button type="button" className="keypad-done" onClick={apply}>Done</button></footer>
  </section>;
}
