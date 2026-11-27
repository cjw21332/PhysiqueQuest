'use client';
import { useState } from 'react';
import MeEditLayout from './MeEditLayout';
import { api } from '../../lib/api';

const categories = [['bug', 'Something is broken'], ['idea', 'Feature idea'], ['praise', 'Something I like'], ['other', 'Other']] as const;
type Category = typeof categories[number][0];

/** Sends feedback about the app itself to the team; admins see it in Engagement analytics. */
export default function AppFeedbackForm({ onBack, onSent }: { onBack: () => void; onSent: () => void }) {
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<Category>('idea');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    if (!rating) { setError('Choose a rating from 1 to 5 stars.'); return; }
    if (message.trim().length < 3) { setError('Tell us a little more (at least 3 characters).'); return; }
    setSaving(true); setError('');
    try {
      await api.saveAppFeedback({ rating, category, message: message.trim() });
      onSent();
    } catch { setError('Could not send feedback. Check your connection and try again.'); }
    finally { setSaving(false); }
  };
  return <MeEditLayout title="Send feedback" description="Tell the PhysiqueQuest team what works and what doesn't. Don't include health details you want kept private." onBack={onBack}
    onDiscard={() => { setRating(0); setMessage(''); setError(''); }} onSave={() => void send()} isDirty={rating > 0 || message.trim().length > 0} isSaving={saving} error={error} saveLabel="Send feedback">
    <div className="choice-group" role="radiogroup" aria-label="Rating">
      <div className="group-title"><b>Rating</b></div>
      <div className="feedback-stars">{[1, 2, 3, 4, 5].map(value => <button type="button" key={value} role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? '' : 's'}`} className={rating >= value ? 'selected' : ''} onClick={() => setRating(value)}>★</button>)}</div>
    </div>
    <label className="field"><span>Type</span><div className="input-wrap"><select value={category} onChange={event => setCategory(event.target.value as Category)}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></label>
    <div className="choice-group notes-group">
      <div className="group-title"><b>Your feedback</b><small>{message.length}/1000</small></div>
      <textarea value={message} maxLength={1000} onChange={event => setMessage(event.target.value)} placeholder="What happened, or what would make the app better?"/>
    </div>
  </MeEditLayout>;
}
