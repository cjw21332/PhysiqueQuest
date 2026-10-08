'use client';
import { ReactNode } from 'react';
import { Icon } from '../Home/icons';

export default function MeEditLayout({
  title,
  description,
  children,
  onBack,
  onDiscard,
  onSave,
  isDirty,
  isSaving,
  error
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  onBack: () => void;
  onDiscard: () => void;
  onSave: () => void;
  isDirty: boolean;
  isSaving?: boolean;
  error?: string;
}) {
  return (
    <section className="me-edit-screen calibration-wizard" aria-label={`Edit ${title}`}>
      <header className="me-header edit-header">
        <button type="button" className="ghost back-btn" onClick={onBack} aria-label="Go back">
          <Icon name="arrow" size={18} />
        </button>
        <h2>{title}</h2>
      </header>
      <div className="me-scroll edit-scroll">
        <div className="step-content">
          {description && <p className="edit-description">{description}</p>}
          {children}
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </div>
      <footer className="wizard-footer edit-footer">
        <button type="button" className="secondary discard-btn" onClick={onDiscard}>Discard</button>
        <button type="button" className="primary save-btn" disabled={!isDirty || isSaving} onClick={onSave}>
          {isSaving ? 'Saving...' : 'Save changes'}
        </button>
      </footer>
    </section>
  );
}
