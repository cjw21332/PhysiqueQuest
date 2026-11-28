'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '../sections/Home/icons';

/** Confirmation dialog; `tone="primary"` is for non-destructive changes such as replacing the weekly plan. */
export default function DeleteConfirmation({ title, description, confirmLabel = 'Delete', busyLabel = 'Deleting…', busy = false, error, tone = 'danger', icon = 'trash', children, onCancel, onConfirm }: { title: string; description: string; confirmLabel?: string; busyLabel?: string; busy?: boolean; error?: string; tone?: 'danger' | 'primary'; icon?: string; children?: ReactNode; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => { const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null; const element = dialog.current; element?.showModal(); return () => { element?.close(); if (opener?.isConnected) opener.focus(); }; }, []);
  return <dialog ref={dialog} className={`delete-confirmation${tone === 'primary' ? ' is-primary' : ''}`} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className="delete-confirm-icon" aria-hidden="true"><Icon name={icon} size={22}/></div>
    <h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p>{children}{error && <p role="alert">{error}</p>}
    <button type="button" className="delete-confirm-action" disabled={busy} onClick={onConfirm}>{busy ? busyLabel : confirmLabel}</button>
    <button type="button" className="delete-confirm-cancel" disabled={busy} onClick={onCancel} autoFocus>Cancel</button>
  </dialog>;
}
