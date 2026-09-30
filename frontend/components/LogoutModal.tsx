'use client';

import { Icon } from '../sections/Home/icons';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LogoutModal({ isOpen, onClose, onConfirm }: LogoutModalProps) {
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

        <button className="logout-confirm-btn" onClick={onConfirm}>
          Log out
        </button>

        <button className="logout-cancel-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
