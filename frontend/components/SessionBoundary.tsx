'use client';
import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../lib/api';
import { clearAuthSession, session } from '../lib/session';

export default function SessionBoundary({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void session.restore(getApiBaseUrl()).then(() => { if (active) setReady(true); }).catch(() => { if (active) setError('Could not restore your session. Check your connection and retry.'); });
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'physiquequest-logout' || event.key === 'physiquequest-runtime-api-url') { clearAuthSession(false); window.location.assign('/'); }
    };
    window.addEventListener('storage', onStorage);
    return () => { active = false; window.removeEventListener('storage', onStorage); };
  }, [attempt]);
  if (!ready) return <div role="status">{error || 'Opening PhysiqueQuest…'}{error && <button type="button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Retry</button>}</div>;
  const user = session.current();
  return <>{user?.emailVerified === false && <aside aria-label="Email verification"><a href="/verify-email">Verify your email</a>{user.legacyEmailAccess ? ' — your account access is unchanged.' : ' to unlock protected features when verification is enabled.'}</aside>}{children}</>;
}
