'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '../sections/Home/icons';
import './whatsNew.css';

export const WHATS_NEW_VERSION = '1.6.0';
export const WHATS_NEW: { icon: string; title: string; text: string }[] = [
  { icon: 'clipboard', title: 'Programs in Coach', text: 'Browse popular training splits and athlete-inspired programs, or build your own with sets, reps, weight and rest.' },
  { icon: 'coach-wand', title: 'Personal suggestions', text: 'Every exercise suggests sets, reps, a starting weight and rest, based on your profile and your logged sets.' },
  { icon: 'dumbbell', title: 'Fits your equipment', text: 'Splits and saved programs swap exercises to match the equipment in your training preferences.' },
  { icon: 'lock', title: 'Stay signed in', text: 'Reopening the app keeps you signed in until you log out. No more “Sign in to sync” reminders.' },
  { icon: 'calendar', title: 'Redesigned Coach', text: 'Today, Programs and Library tabs, with a clearer weekly view and session card.' },
];
// Shown once per version: the device remembers the version it showed, so reopening the app does not
// repeat it. The per-launch flag stays honoured (tests and older builds set it).
const SHOWN_KEY = 'pq-whats-new-shown';
const SEEN_VERSION_KEY = 'pq-whats-new-seen-version';
// Decided once per page load, so React re-running the effect cannot report it closed while it is open.
let showThisLaunch: boolean | null = null;

/** Shows what changed in this version once per device. Render it only for signed-in users. */
export default function WhatsNew({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (showThisLaunch === null) {
      let shown = false;
      try { shown = sessionStorage.getItem(SHOWN_KEY) === '1' || localStorage.getItem(SEEN_VERSION_KEY) === WHATS_NEW_VERSION; } catch {}
      // Never interrupt a live workout.
      showThisLaunch = !shown && !pathname?.startsWith('/coach/session');
      if (showThisLaunch) try { sessionStorage.setItem(SHOWN_KEY, '1'); localStorage.setItem(SEEN_VERSION_KEY, WHATS_NEW_VERSION); } catch {}
    }
    if (showThisLaunch) setOpen(true); else onClose();
  // Decide once per mount; later navigation must not reopen it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); }, [open]);

  if (!open) return null;
  const close = () => { showThisLaunch = false; dialog.current?.close(); setOpen(false); onClose(); };
  return <dialog ref={dialog} className="whats-new" aria-labelledby="whats-new-title" onCancel={event => { event.preventDefault(); close(); }}>
    <header>
      <span className="whats-new-badge">Version {WHATS_NEW_VERSION}</span>
      <h2 id="whats-new-title">What&apos;s new</h2>
      <button type="button" className="whats-new-x" onClick={close} aria-label="Close what's new"><Icon name="close" size={18}/></button>
    </header>
    <ul>{WHATS_NEW.map(item => <li key={item.title}>
      <span className="whats-new-icon" aria-hidden="true"><Icon name={item.icon} size={18}/></span>
      <span><strong>{item.title}</strong><small>{item.text}</small></span>
    </li>)}</ul>
    <button type="button" className="whats-new-done" onClick={close} autoFocus>Got it</button>
  </dialog>;
}
