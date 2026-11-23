"use client";
import { useId, useRef, useState } from 'react';
import { api, ApiRequestError } from '../../lib/api';
import './equipment-check.css';

// The server accepts at most ~120 KB of base64. Step down size and quality
// until the photo fits instead of failing on detailed images.
const ATTEMPTS: readonly [number, number][] = [[480, 0.55], [400, 0.5], [320, 0.45]];
const MAX_DATA_URL = 110_000;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

async function preparePhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('not-image');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('too-large');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const drawing = canvas.getContext('2d');
    if (!drawing) throw new Error('unavailable');
    for (const [edge, quality] of ATTEMPTS) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      drawing.drawImage(image, 0, 0, canvas.width, canvas.height);
      const photo = canvas.toDataURL('image/jpeg', quality);
      if (photo.length <= MAX_DATA_URL) return photo;
    }
    throw new Error('too-large');
  } finally { URL.revokeObjectURL(url); }
}

type Review = { tone: 'alert' | 'info'; text: string };

export default function EquipmentCheck({ issue, onIssue }: { issue: boolean; onIssue: (value: boolean) => void }) {
  const [file, setFile] = useState<File>();
  const [consent, setConsent] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const consentId = useId();

  async function send() {
    if (!file || !consent || busy) return;
    setBusy(true);
    setReview(null);
    try {
      const result = await api.checkEquipment(await preparePhoto(file));
      if (result.status === 'visible_damage') {
        onIssue(true);
        setReview({ tone: 'alert', text: 'Possible damage is visible. Do not use this equipment and ask gym staff to inspect it.' });
      } else {
        setReview({ tone: 'info', text: 'No clear damage was spotted, but a photo cannot confirm safety. Check cables, pins, straps and supports by hand before use.' });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      setReview({ tone: 'info', text: reason === 'not-image' ? 'Choose an image file.'
        : reason === 'too-large' ? 'This photo is too large to review. Try a closer, simpler shot.'
        : error instanceof ApiRequestError && (error.statusCode === 404 || error.statusCode === 429) ? 'Photo review is not available right now. Inspect the equipment in person.'
        : 'Photo review unavailable. Inspect the equipment in person.' });
    } finally {
      setBusy(false);
      // Nothing about the photo is kept after a review attempt.
      setFile(undefined);
      if (input.current) input.current.value = '';
    }
  }

  return <fieldset className="equipment-check"><legend>Equipment check</legend>
    <div className="equipment-check-body">
      <label><input type="checkbox" checked={issue} onChange={e => onIssue(e.target.checked)}/> I see damage or an unstable attachment</label>
      {issue && <p role="alert" className="equipment-check-alert">Stop using this equipment. Switch to intact equipment, then untick this box to start.</p>}
      <details><summary>Review an equipment photo</summary>
        <p>Take or choose a photo of the equipment with no people in it. It is resized on this device and sent once to our AI service, which can flag visible damage. The photo is not stored. A photo cannot confirm that equipment is safe.</p>
        <input ref={input} aria-label="Equipment photo" type="file" accept="image/*" disabled={busy} onChange={e => { setFile(e.target.files?.[0]); setReview(null); }}/>
        <label className="equipment-check-consent" htmlFor={consentId}><input id={consentId} type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)}/> I agree to send this photo to the AI service for review</label>
        <button type="button" disabled={!file || !consent || busy} onClick={() => void send()}>{busy ? 'Reviewing photo…' : 'Send photo for review'}</button>
        {review && <p role={review.tone === 'alert' ? 'alert' : 'status'} className={review.tone === 'alert' ? 'equipment-check-alert' : 'equipment-check-message'}>{review.text}</p>}
      </details>
    </div></fieldset>;
}
