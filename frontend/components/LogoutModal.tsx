'use client';

import { Icon } from '../sections/Home/icons';
import { useState } from 'react';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function LogoutModal({ isOpen, onClose, onConfirm }: LogoutModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    setBusy(true); setError('');
    try { await onConfirm(); }
    catch { setError('Could not log out. Check your connection and retry.'); }
    finally { setBusy(false); }
  };
  if (!isOpen) return null;

  return (
    <div className="logout-overlay" onClick={onClose}>
      <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="logout-icon-container">
          <Icon name="logout" size={24} />
        </div>

        <h2 className="logout-title">Log out of PhysiqueQuest?</h2>

        <p className="logout-description">
          Your plan, streak and history stay saved. Inactivity monitoring stops on this device until you log back in.
        </p>

        {error && <p role="alert">{error}</p>}
        <button className="logout-confirm-btn" onClick={confirm} disabled={busy}>
          Log out
        </button>

        <button className="logout-cancel-btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
