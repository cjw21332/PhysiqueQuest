'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { Icon } from '../Home/icons';
import './leaderboard.css';

export default function OfflineLeaderboard() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const back = () => router.push('/quests');
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);
  const retry = async () => {
    if (checking) return;
    if (!navigator.onLine) { setMessage('Still offline. Connect to Wi-Fi or mobile data, then try again.'); return; }
    setChecking(true); setMessage('');
    try {
      await api.getLeaderboard('week');
      window.dispatchEvent(new Event('physiquequest:connection-restored'));
    } catch {
      setMessage('Still unable to connect. Check your connection and try again.');
    } finally { setChecking(false); }
  };
  return <section className="quest-section leaderboard-screen leaderboard-offline" aria-label="Leaderboard">
    <div className="leaderboard-offline-preview" aria-hidden="true" inert>
      <header className="leaderboard-header pq-page-heading"><span className="coach-back"><Icon name="arrow" size={20}/></span><h2>Leaderboard</h2></header>
      <div className="leaderboard-scroll">
        <div className="leaderboard-mode"><button type="button" aria-pressed="true"><strong>Quests</strong><small>Points earned</small></button><button type="button"><strong>Strength</strong><small>Logged lifts</small></button></div>
        <div className="leaderboard-periods"><button type="button" className="selected">This week</button><button type="button">This month</button><button type="button">All time</button></div>
        <section className="leaderboard-podium">{[2, 1, 3].map(rank => <div className={`podium-player podium-rank-${rank}`} key={rank}>{rank === 1 && <Icon name="crown" size={19}/>}<div className="podium-avatar">—</div><strong>—</strong><small>— pts</small><div className="podium-step">{rank}</div></div>)}</section>
        <div className="leaderboard-rankings">{[4, 5, 6].map(rank => <div className="leaderboard-row" key={rank}><span className="leaderboard-rank">{rank}</span><span className="leaderboard-avatar">—</span><span className="leaderboard-person"><strong>—</strong><small>— pts</small></span></div>)}</div>
      </div>
    </div>
    <dialog ref={dialog} className="leaderboard-offline-dialog" aria-labelledby="leaderboard-offline-title" aria-describedby="leaderboard-offline-description" onCancel={event => { event.preventDefault(); back(); }}>
      <span className="leaderboard-offline-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8.8a15.6 15.6 0 0 1 20 0M5.5 12.3a10 10 0 0 1 13 0M9 15.8a4.8 4.8 0 0 1 6 0M12 19h.01"/><path d="M3 3l18 18"/></svg></span>
      <h2 id="leaderboard-offline-title">Connect to see rankings</h2>
      <p id="leaderboard-offline-description">The leaderboard needs an internet connection to show the latest rankings. Connect to Wi-Fi or mobile data to continue.</p>
      {message && <p className="leaderboard-offline-message" role="status">{message}</p>}
      <button className="primary" type="button" disabled={checking} onClick={() => void retry()} autoFocus>{checking ? 'Checking connection…' : 'Try again'}</button>
      <button className="leaderboard-offline-back" type="button" disabled={checking} onClick={back}>Back to quests</button>
    </dialog>
  </section>;
}
