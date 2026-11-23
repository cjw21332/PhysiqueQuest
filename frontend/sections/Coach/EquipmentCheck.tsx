"use client";
import { useState } from 'react';
import { api } from '../../lib/api';

async function preparePhoto(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 480 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const drawing = canvas.getContext('2d');
    if (!drawing) throw new Error('Photo unavailable');
    drawing.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.55);
  } finally { URL.revokeObjectURL(url); }
}

export default function EquipmentCheck({ issue, onIssue }: { issue: boolean; onIssue: (value: boolean) => void }) {
  const [file, setFile] = useState<File>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function review() {
    if (!file || busy) return;
    setBusy(true);
    try {
      const result = await api.checkEquipment(await preparePhoto(file));
      const reported = result.status === 'visible_damage';
      if (reported) onIssue(true);
      setMessage(reported ? 'Possible damage is visible. Ask gym staff to inspect this equipment.' : 'Photo review was inconclusive. Inspect cables, attachments and supports before use.');
    } catch { setMessage('Photo review unavailable. Inspect the equipment in person.'); }
    finally { setBusy(false); }
  }
  return <fieldset><legend>Equipment check</legend>
    <label><input type="checkbox" checked={issue} onChange={e => onIssue(e.target.checked)}/> I see damage or an unstable attachment</label>
    {issue && <p role="alert">Stop using this equipment. Switch to intact equipment before starting.</p>}
    <details><summary>Review an equipment photo</summary><p>Choose a photo of the equipment without people. Sending it to the AI service can flag visible damage. A photo cannot confirm that equipment is safe.</p>
      <input aria-label="Equipment photo" type="file" accept="image/*" disabled={busy} onChange={e => {setFile(e.target.files?.[0]); setMessage('');}}/>
      <button type="button" disabled={!file || busy} onClick={review}>{busy ? 'Reviewing photo…' : 'Send photo for review'}</button>
      {message && <p role="status">{message}</p>}
    </details></fieldset>;
}
