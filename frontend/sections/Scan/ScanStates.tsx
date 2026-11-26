'use client';
import { useSyncExternalStore } from 'react';
import { Icon } from '../Home/icons';

const subscribe = (notify: () => void) => {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => { window.removeEventListener('online', notify); window.removeEventListener('offline', notify); };
};
/** The device's own internet state; the backend link is tracked separately by ConnectionContext. */
export const useDeviceOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

// SessionBoundary re-checks the service on focus, so this asks for an immediate check.
const checkNow = () => window.dispatchEvent(new Event('focus'));

/** Explains why Scan is read-only: no internet, or internet but the service is still connecting. */
export function ScanConnectionBanner({ online }: { online: boolean }) {
  return <section className={`scan-conn-banner ${online ? 'is-connecting' : 'is-offline'}`} role="status" aria-live="polite">
    <span className="scan-conn-icon" aria-hidden="true">{online ? <span className="scan-conn-spinner"/> : <Icon name="warning" size={18}/>}</span>
    <span className="scan-conn-copy">
      <strong>{online ? 'Connecting to PhysiqueQuest…' : 'You’re offline'}</strong>
      <small>{online ? 'Showing meals saved on this device. Scanning and logging unlock as soon as sync finishes.' : 'Showing meals saved on this device. Scanning, logging and edits unlock when you reconnect.'}</small>
    </span>
    {online && <button type="button" className="scan-conn-retry" onClick={checkNow}>Retry</button>}
  </section>;
}

/** Placeholder shaped like the dashboard so the page does not jump when data arrives. */
export function ScanSkeleton({ label = 'Loading your nutrition…' }: { label?: string }) {
  return <div className="scan-skeleton" role="status" aria-busy="true" aria-label={label}>
    <div className="scan-skel-row"><span className="scan-skel w40 h28"/><span className="scan-skel w30 h36 pill"/></div>
    <div className="scan-skel-days">{Array.from({ length: 7 }, (_, i) => <span key={i} className="scan-skel day"/>)}</div>
    <div className="scan-skel-card">
      <span className="scan-skel ring"/>
      <div className="scan-skel-bars">{[70, 55, 40].map(w => <span key={w}><span className="scan-skel w30 h10"/><span className="scan-skel h8" style={{ width: `${w}%` }}/></span>)}</div>
    </div>
    <span className="scan-skel h64 card"/>
    {[0, 1, 2].map(i => <span key={i} className="scan-skel h56 card"/>)}
    <p className="scan-skel-label">{label}</p>
  </div>;
}

/** Shown when nothing was saved on this device for Scan to display. */
export function ScanEmptyState({ online, onRetry }: { online: boolean; onRetry: () => void }) {
  return <section className="scan-empty-state">
    <span className="scan-empty-icon" aria-hidden="true"><Icon name="meal" size={28}/></span>
    <h2>{online ? 'Your nutrition is still syncing' : 'No saved meals on this device'}</h2>
    <p>{online ? 'PhysiqueQuest is reconnecting. Your meals appear here as soon as they load.' : 'Open Scan once while connected and your meals stay available offline.'}</p>
    <button type="button" className="scan-conn-retry wide" onClick={() => { checkNow(); onRetry(); }}>Try again</button>
  </section>;
}
