'use client';
import { ReactNode } from 'react';
import { Icon } from '../Home/icons';
import styles from './MeEditLayout.module.css';
import { useBackendConnection } from '../../hooks/useBackendConnection';

export default function MeEditLayout({
  title,
  description,
  children,
  onBack,
  onDiscard,
  onSave,
  isDirty,
  isSaving,
  error,
  saveLabel = 'Save changes'
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
  saveLabel?: string;
}) {
  const connected = useBackendConnection();
  return (
    <section className={`me-edit-screen calibration-wizard me-reference-edit ${styles.layout}`} data-editor={title.toLowerCase().replace(/\s+/g, '-')} aria-label={`Edit ${title}`}>
      <header className="me-header edit-header pq-page-heading">
        <button type="button" className="coach-back" onClick={onBack} disabled={isSaving} aria-label="Go back">
          <Icon name="arrow" size={18} />
        </button>
        <h2>{title}</h2>
      </header>
      <div className="me-scroll edit-scroll">
        {!connected && <p role="status">Offline · saved information is read-only.</p>}
        <fieldset className="step-content" disabled={isSaving || !connected}>
          {description && <p className="edit-description">{description}</p>}
          {children}
          {/* Stable id so a form can point its failing field at this message with aria-describedby. */}
          {error && <p id="me-edit-error" className="error" role="alert">{error}</p>}
        </fieldset>
      </div>
      {connected && <footer className="wizard-footer edit-footer">
        <button type="button" className="secondary discard-btn" onClick={onDiscard} disabled={isSaving || !isDirty}>Discard</button>
        <button type="button" className="primary save-btn" disabled={!isDirty || isSaving} onClick={onSave}>
          {isSaving ? 'Saving...' : saveLabel}
        </button>
      </footer>}
    </section>
  );
}
