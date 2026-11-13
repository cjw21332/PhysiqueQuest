'use client';

import { useEffect, useId, useRef } from 'react';
import { Icon } from '../sections/Home/icons';

export default function OutcomeDialog({ kind, title, message, onClose, actionLabel = 'Done', actionDisabled = false, onAction, secondaryLabel, onSecondary }: { kind: 'success' | 'error' | 'info'; title: string; message: string; onClose: () => void; actionLabel?: string; actionDisabled?: boolean; onAction?: () => void; secondaryLabel?: string; onSecondary?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId(), messageId = useId();
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={ref} className="outcome-dialog" aria-labelledby={titleId} aria-describedby={messageId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <span className={`outcome-dialog-icon outcome-dialog-icon-${kind}`} aria-hidden="true"><Icon name={kind === 'success' ? 'check' : kind === 'error' ? 'warning' : 'clock'} size={22}/></span>
    <h2 id={titleId}>{title}</h2><p id={messageId}>{message}</p>
    <button type="button" disabled={actionDisabled} onClick={onAction ?? onClose} autoFocus>{actionLabel}</button>
    {secondaryLabel && onSecondary && <button type="button" className="outcome-dialog-secondary" onClick={onSecondary}>{secondaryLabel}</button>}
  </dialog>;
}
