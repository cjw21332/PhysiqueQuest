'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '../sections/Home/icons';
import './whatsNew.css';

export const WHATS_NEW_VERSION = '1.5.6';
export const WHATS_NEW: { icon: string; title: string; text: string }[] = [
  { icon: 'check-circle', title: 'Clear sync status', text: 'Connecting retries quickly and a green “Connected” notice confirms when everything is synced.' },
  { icon: 'edit', title: 'New workout log', text: 'A redesigned manual log with a progress ring, set-by-set tiles and Next exercise buttons.' },
  { icon: 'trophy', title: 'Better leaderboard', text: 'See your rank, how close you are to the next player, and a podium for the top three.' },
  { icon: 'scan', title: 'Scan works offline', text: 'Saved meals stay visible offline or while syncing, with a clear note on what unlocks when you reconnect.' },
  { icon: 'arrow-left', title: 'Back button stays in the app', text: 'Your phone’s Back button closes popups and goes back a screen. On Home, press it twice to exit.' },
];
// sessionStorage lives for one app launch, so the popup returns on every open but not on every page change.
const SHOWN_KEY = 'pq-whats-new-shown';
// Decided once per page load, so React re-running the effect cannot report it closed while it is open.
let showThisLaunch: boolean | null = null;

/** Shows what changed in this version once per app launch. Render it only for signed-in users. */
export default function WhatsNew({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (showThisLaunch === null) {
      let shown = false;
      try { shown = sessionStorage.getItem(SHOWN_KEY) === '1'; } catch {}
      // Never interrupt a live workout.
      showThisLaunch = !shown && !pathname?.startsWith('/coach/session');
      if (showThisLaunch) try { sessionStorage.setItem(SHOWN_KEY, '1'); } catch {}
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
