'use client';

import { Icon } from '../sections/Home/icons';
import { useEffect, useId, useRef, useState } from 'react';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function LogoutModal({ isOpen, onClose, onConfirm }: LogoutModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId(), descriptionId = useId();
  // A native modal dialog is what gives this prompt the Escape key, a focus
  // trap and focus returning to the control that opened it; the plain overlay
  // this replaced had none of them.
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (opener?.isConnected) opener.focus(); };
  }, [isOpen]);
  const confirm = async () => {
    setBusy(true); setError('');
    try { await onConfirm(); }
    catch { setError('Could not log out. Check your connection and retry.'); }
    finally { setBusy(false); }
  };
  if (!isOpen) return null;

  return (
    <dialog
      ref={dialog}
      className="logout-overlay"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={event => { if (event.target === dialog.current && !busy) onClose(); }}
    >
      <div className="logout-modal">
        <div className="logout-icon-container">
          <Icon name="logout" size={24} />
        </div>

        <h2 className="logout-title" id={titleId}>Log out of PhysiqueQuest?</h2>

        <p className="logout-description" id={descriptionId}>
          Your plan, streak and history stay saved. Inactivity monitoring stops on this device until you log back in.
        </p>

        {error && <p role="alert">{error}</p>}
        <button type="button" className="logout-confirm-btn" onClick={() => void confirm()} disabled={busy}>
          {busy ? 'Logging out…' : 'Log out'}
        </button>

        <button type="button" className="logout-cancel-btn" onClick={onClose} disabled={busy} autoFocus>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
