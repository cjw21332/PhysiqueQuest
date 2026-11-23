"use client";
import { useState, type FormEvent } from 'react';
import { api, ApiRequestError } from '../../lib/api';
import { titleCase } from '../../lib/titleCase';
import './workout-feedback.css';

const MAX_PAIN_LOCATIONS = 10;
const MAX_PAIN_LENGTH = 40;

type Status = { state: 'ready' | 'saving' | 'saved' } | { state: 'error'; message: string };

export function parsePainLocations(raw: string) {
  return [...new Set(raw.split(',').map(value => value.trim()).filter(Boolean))];
}

export default function WorkoutFeedback({ source, exercise, sessionRef }: { source: 'manual' | 'pose'; exercise: string; sessionRef?: string }) {
  const [status, setStatus] = useState<Status>({ state: 'ready' });
  const name = titleCase(exercise);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const painLocations = parsePainLocations(String(fields.get('pain') || ''));
    if (painLocations.length > MAX_PAIN_LOCATIONS) { setStatus({ state: 'error', message: `Enter up to ${MAX_PAIN_LOCATIONS} pain locations.` }); return; }
    if (painLocations.some(value => value.length > MAX_PAIN_LENGTH)) { setStatus({ state: 'error', message: `Keep each pain location to ${MAX_PAIN_LENGTH} characters, for example "left knee".` }); return; }
    setStatus({ state: 'saving' });
    try {
      await api.saveWorkoutFeedback({ source, exercise, sessionRef, rpe: Number(fields.get('rpe')), difficulty: String(fields.get('difficulty')),
        enjoyment: Number(fields.get('enjoyment')) || undefined, painLocations, notes: String(fields.get('notes') || '').trim() || undefined });
      setStatus({ state: 'saved' });
    } catch (error) {
      const code = error instanceof ApiRequestError ? error.statusCode : 0;
      setStatus({ state: 'error', message: code === 404 ? 'Feedback is not available on the server yet. Please try again after the next update.'
        : code === 400 ? 'Some answers could not be accepted. Check the values and try again.'
        : code === 401 || code === 403 ? 'Sign in again to save feedback.'
        : 'Could not save feedback. Check your connection and try again.' });
    }
  }
  if (status.state === 'saved') return <p role="status" className="workout-feedback-status">Thanks — feedback saved for {name}. Your Coach plan will adapt.</p>;
  const saving = status.state === 'saving';
  return <details className="workout-feedback"><summary>How did {name} feel?</summary>
    <form onSubmit={submit} onChange={() => { if (status.state === 'error') setStatus({ state: 'ready' }); }}>
      <label>Effort (1 = very easy, 10 = maximal)<input required type="number" inputMode="numeric" name="rpe" min="1" max="10" step="1"/></label>
      <label>Difficulty<select required name="difficulty" defaultValue=""><option value="" disabled>Choose difficulty</option><option value="too_easy">Too easy</option><option value="just_right">Just right</option><option value="too_hard">Too hard</option></select></label>
      <label>Enjoyment (optional, 1 to 5)<input type="number" inputMode="numeric" name="enjoyment" min="1" max="5" step="1"/></label>
      <label>Pain locations (optional, separated by commas)<input name="pain" maxLength={(MAX_PAIN_LENGTH + 2) * MAX_PAIN_LOCATIONS} placeholder="e.g. left knee, lower back"/></label>
      <label>Private notes (optional)<textarea name="notes" maxLength={500}/></label>
      <p className="workout-feedback-note">Reporting pain removes this exercise from upcoming Coach plans. Pain locations and notes are stored privately and never shared with chat. Sharp or lasting pain should be checked by a health professional.</p>
      <button disabled={saving}>{saving ? 'Saving…' : 'Save feedback'}</button>
      {status.state === 'error' && <p role="alert" className="workout-feedback-error">{status.message}</p>}
    </form></details>;
}
