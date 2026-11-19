'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Home/icons';
import './photoConfirmation.css';

export default function PhotoConfirmation({ file, onCancel, onConfirm }: { file: File; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    dialog?.showModal();
    return () => {
      dialog?.close();
      URL.revokeObjectURL(url);
      if (opener?.isConnected && !opener.classList.contains('visually-hidden')) opener.focus();
      else document.querySelector<HTMLButtonElement>('.scan-dashboard-scan')?.focus();
    };
  }, [file]);

  return <dialog ref={dialogRef} className="photo-confirmation" aria-labelledby="photo-confirmation-title" aria-describedby="photo-confirmation-description" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <div className="photo-confirmation-header">
      <span className="photo-confirmation-eyebrow">MEAL SCAN</span>
      <button type="button" className="photo-confirmation-close" onClick={onCancel} aria-label="Close photo confirmation"><Icon name="close" size={20}/></button>
    </div>
    <h2 id="photo-confirmation-title">Ready to scan?</h2>
    <p className="photo-confirmation-intro">Check your photo before we identify your meal.</p>
    <div className="photo-confirmation-preview">
      {previewUrl && !previewFailed ? <img src={previewUrl} alt="Selected meal photo" width={640} height={360} onError={() => setPreviewFailed(true)}/> : <div className="photo-confirmation-placeholder"><Icon name="image" size={28}/><span>Photo selected</span></div>}
      <span className="photo-confirmation-preview-label">YOUR PHOTO</span>
    </div>
    <div className="photo-confirmation-notice">
      <span className="photo-confirmation-notice-icon" aria-hidden="true"><Icon name="shield" size={18}/></span>
      <p id="photo-confirmation-description">Your photo is sent to our AI service to identify the food.</p>
    </div>
    <div className="photo-confirmation-actions">
      <button type="button" className="photo-confirmation-primary" onClick={onConfirm} autoFocus><Icon name="scan" size={18}/> Confirm and analyse</button>
      <button type="button" className="photo-confirmation-secondary" onClick={onCancel}>Cancel</button>
    </div>
  </dialog>;
}
