'use client';
import { useEffect, useRef } from 'react';
import { Icon } from '../Home/icons';

export default function SessionChoice({ onClose, onChoose, onReviewVideo, busy, error }: { onClose: () => void; onChoose: () => void; onReviewVideo: () => void; busy: boolean; error?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null; dialog.current?.showModal(); return () => { dialog.current?.close(); if (opener?.isConnected) opener.focus(); }; }, []);
  return <dialog ref={dialog} className="session-choice" aria-labelledby="session-choice-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><header><div><h2 id="session-choice-title">Choose how to train</h2><p>Select how you want to start this session.</p></div><button type="button" aria-label="Close" disabled={busy} onClick={onClose}><Icon name="close" size={20}/></button></header>
    <button type="button" className="session-choice-option" disabled={busy} onClick={onChoose}><span><Icon name="edit" size={21}/></span><span><strong>Log manually</strong><small>Record sets and reps without a camera.</small></span><Icon name="arrow" size={16}/></button>
    <button type="button" className="session-choice-option" disabled={busy} onClick={onReviewVideo}><span><Icon name="upload" size={21}/></span><span><strong>Review a video</strong><small>Choose a recording for optional analysis.</small></span><Icon name="arrow" size={16}/></button>
    {busy && <p role="status">Starting your session…</p>}{error && <p role="alert">{error}</p>}
  </dialog>;
}
