'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import ForgotPasswordFlow from '../sections/Forgot Password/ForgotPasswordFlow';
import { getApiBaseUrl } from '../lib/api';
import { clearAuthSession, session } from '../lib/session';

export default function SessionBoundary({ children }: { children: React.ReactNode }) {
  const user = useSyncExternalStore(session.subscribe, session.current, () => null);
  const pathname = usePathname();
  const [dismissedUser, setDismissedUser] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { if (!user) setDismissedUser(null); }, [user]);
  useEffect(() => {
    let active = true;
    void session.restore(getApiBaseUrl()).then(() => { if (active) setReady(true); }).catch(() => { if (active) setError('Could not restore your session. Check your connection and retry.'); });
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'physiquequest-logout' || event.key === 'physiquequest-runtime-api-url') { clearAuthSession(false); window.location.assign('/'); }
    };
    window.addEventListener('storage', onStorage);
    return () => { active = false; window.removeEventListener('storage', onStorage); };
  }, [attempt]);
  if (!ready) return error ? <div role="alert">{error}<button type="button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Retry</button></div> : null;
  return <>{children}{user?.emailVerified === false && dismissedUser !== user.id && pathname !== '/verify-email' && <ForgotPasswordFlow mode="verify-email" accountEmail={user.email} onClose={() => setDismissedUser(user.id)} onSuccess={() => { setDismissedUser(user.id); void session.refresh(getApiBaseUrl()).catch(() => {}); }} />}</>;
}
