"use client";
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';

export default function WorkoutFeedback({ source, exercise, sessionRef }: { source: 'manual' | 'pose'; exercise: string; sessionRef?: string }) {
  const [status, setStatus] = useState<'ready' | 'saving' | 'saved' | 'error'>('ready');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const painLocations = String(fields.get('pain') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (painLocations.length > 10 || painLocations.some(value => value.length > 40)) {
      setStatus('error'); return;
    }
    setStatus('saving');
    try {
      await api.saveWorkoutFeedback({ source, exercise, sessionRef, rpe: Number(fields.get('rpe')), difficulty: String(fields.get('difficulty')),
        enjoyment: Number(fields.get('enjoyment')) || undefined, painLocations, notes: String(fields.get('notes') || '').trim() || undefined });
      setStatus('saved');
    } catch { setStatus('error'); }
  }
  if (status === 'saved') return <p role="status">Feedback saved for {exercise}.</p>;
  return <details><summary>Give feedback on {exercise}</summary><form onSubmit={submit}>
    <label>Effort (1 to 10)<input required type="number" name="rpe" min="1" max="10"/></label>
    <label>Difficulty<select required name="difficulty" defaultValue=""><option value="" disabled>Choose difficulty</option><option value="too_easy">Too easy</option><option value="just_right">Just right</option><option value="too_hard">Too hard</option></select></label>
    <label>Enjoyment (optional, 1 to 5)<input type="number" name="enjoyment" min="1" max="5"/></label>
    <label>Pain locations (optional, separated by commas)<input name="pain" maxLength={409}/></label>
    <label>Private notes (optional)<textarea name="notes" maxLength={500}/></label>
    <p>Pain locations and notes stay out of chat.</p>
    <button disabled={status === 'saving'}>{status === 'saving' ? 'Saving…' : 'Save feedback'}</button>
    {status === 'error' && <p role="alert">Could not save. Check your connection and enter up to ten pain locations of 40 characters each.</p>}
  </form></details>;
}
