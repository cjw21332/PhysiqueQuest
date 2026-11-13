'use client';
import { useEffect, useId, useRef } from 'react';
import { Icon } from '../sections/Home/icons';

export default function DeleteConfirmation({ title, description, confirmLabel = 'Delete', busy = false, error, onCancel, onConfirm }: { title: string; description: string; confirmLabel?: string; busy?: boolean; error?: string; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => { const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null; const element = dialog.current; element?.showModal(); return () => { element?.close(); if (opener?.isConnected) opener.focus(); }; }, []);
  return <dialog ref={dialog} className="delete-confirmation" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className="delete-confirm-icon" aria-hidden="true"><Icon name="trash" size={22}/></div>
    <h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p>{error && <p role="alert">{error}</p>}
    <button type="button" className="delete-confirm-action" disabled={busy} onClick={onConfirm}>{busy ? 'Deleting…' : confirmLabel}</button>
    <button type="button" className="delete-confirm-cancel" disabled={busy} onClick={onCancel} autoFocus>Cancel</button>
  </dialog>;
}
