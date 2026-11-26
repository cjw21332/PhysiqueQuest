'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const MAIN_TABS = ['/home', '/coach', '/scan', '/quests', '/me'];
// Roots where Back asks to exit instead of navigating further back.
const EXIT_ROOTS = ['/', '/home', '/launch', '/login'];
const OVERLAYS = 'dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]';
const CLOSE_CONTROL = 'button[aria-label*="close" i], button[aria-label*="dismiss" i], button[aria-label^="back" i], button[aria-label^="cancel" i]';
const DISMISS_TEXT = /^(close|cancel|not now|dismiss|back|keep training|got it|done|ok)$/i;
const PAGE_BACK = '.coach-back, .leaderboard-back, .back-btn, .pq-progress-back, button[aria-label^="Back" i]';

const visible = (el: Element) => (el as HTMLElement).getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const topOverlay = () => [...document.querySelectorAll(OVERLAYS)].filter(el => visible(el) && !el.closest('[inert]')).pop();

/** Closes the top popup the way Escape would, falling back to its own close/cancel control. */
function closeOverlay(el: Element) {
  if (el instanceof HTMLDialogElement && el.open) {
    // React dialogs listen for `cancel`; an unhandled one closes like the Escape key.
    if (el.dispatchEvent(new Event('cancel', { cancelable: true }))) el.close();
    return;
  }
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  setTimeout(() => {
    if (!el.isConnected || !visible(el)) return;
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    (el.querySelector<HTMLButtonElement>(CLOSE_CONTROL) ?? buttons.find(b => DISMISS_TEXT.test(b.textContent?.trim() ?? '')))?.click();
  }, 80);
}

/**
 * Android's Back button, delivered by the app shell as `physiquequest:hardware-back`.
 * Order: top popup → the screen's own back button → previous page → Home → ask the shell to exit.
 */
export default function HardwareBack() {
  const router = useRouter();
  useEffect(() => {
    const reply = (exit: boolean) => window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'hardware-back-result', exit }));
    const onBack = () => {
      const overlay = topOverlay();
      if (overlay) { closeOverlay(overlay); reply(false); return; }
      const pageBack = [...document.querySelectorAll<HTMLButtonElement>(PAGE_BACK)].find(b => visible(b) && !b.disabled && !b.closest(OVERLAYS));
      if (pageBack) { pageBack.click(); reply(false); return; }
      const path = window.location.pathname.replace(/\/$/, '') || '/';
      if (EXIT_ROOTS.includes(path)) { reply(true); return; }
      if (MAIN_TABS.includes(path)) { router.push('/home'); reply(false); return; }
      if (window.history.length > 1) window.history.back(); else router.push('/home');
      reply(false);
    };
    window.addEventListener('physiquequest:hardware-back', onBack);
    return () => window.removeEventListener('physiquequest:hardware-back', onBack);
  }, [router]);
  return null;
}
