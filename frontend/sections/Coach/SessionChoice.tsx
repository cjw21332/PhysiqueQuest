'use client';
import { useEffect, useRef } from 'react';
import { Icon } from '../Home/icons';

export default function SessionChoice({ onClose, onChoose, busy, error, allowLive = true }: { onClose: () => void; onChoose: (mode: 'live' | 'upload' | 'manual') => void; busy: boolean; error?: string; allowLive?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null; dialog.current?.showModal(); return () => { dialog.current?.close(); if (opener?.isConnected) opener.focus(); }; }, []);
  return <dialog ref={dialog} className="session-choice" aria-labelledby="session-choice-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><header><div><h2 id="session-choice-title">Choose how to train</h2><p>Select how you want to start this session.</p></div><button type="button" aria-label="Close" disabled={busy} onClick={onClose}><Icon name="close" size={20}/></button></header>
    {!allowLive && <p>Personal exercises are available for manual logging and video review.</p>}
    {([['live','camera','Live session','Use your camera during your workout.'],['upload','upload','Review a video','Choose a recording for optional analysis.'],['manual','edit','Log manually','Record sets and reps without a camera.']] as const).filter(([mode]) => allowLive || mode !== 'live').map(([mode,icon,title,description]) => <button key={mode} type="button" className="session-choice-option" disabled={busy} onClick={() => onChoose(mode)}><span><Icon name={icon} size={21}/></span><span><strong>{title}</strong><small>{description}</small></span><Icon name="arrow" size={16}/></button>)}
    {busy && <p role="status">Starting your session…</p>}{error && <p role="alert">{error}</p>}
  </dialog>;
}
