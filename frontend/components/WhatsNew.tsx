'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '../sections/Home/icons';
import './whatsNew.css';

export const WHATS_NEW_VERSION = '1.6.1';
export const WHATS_NEW: { icon: string; title: string; text: string }[] = [
  { icon: 'home', title: 'Redesigned Home', text: 'Your level, streak and points up top, today’s session front and centre, and missions with progress rings.' },
  { icon: 'meal', title: 'Clearer nutrition', text: 'A calorie ring shows what’s left today, with protein, carbs and fats side by side.' },
  { icon: 'target', title: 'Goals at a glance', text: 'See current and target weight together, this week’s training days and your recent check-ins.' },
  { icon: 'trend', title: 'Refreshed Progress', text: 'Tabs for overview, exercises, muscles and records, with a bigger trend chart and history.' },
  { icon: 'bell', title: 'Tidier notifications', text: 'Pinned safety notices, clearer unread updates, and reminder settings in one place.' },
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
