'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import ForgotPasswordFlow from '../sections/Forgot Password/ForgotPasswordFlow';
import { api, deviceCache, getApiBaseUrl } from '../lib/api';
import OutcomeDialog from './OutcomeDialog';
import { clearAuthSession, session } from '../lib/session';
import { DATA_CHANGE_EVENT, DATA_CHANGE_KEY, parseDataChange } from '../lib/dataChanges.mjs';

export default function SessionBoundary({ children }: { children: React.ReactNode }) {
  const user = useSyncExternalStore(session.subscribe, session.current, () => null);
  const pathname = usePathname();
  const [dismissedUser, setDismissedUser] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [connectionLost, setConnectionLost] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const dismissedOffline = useRef(false);
  useEffect(() => {
    if (!user) { setConnectionLost(false); dismissedOffline.current = false; return; }
    const lost = () => { if (!dismissedOffline.current) setConnectionLost(true); };
    const restored = () => { dismissedOffline.current = false; setConnectionLost(false); setRetryFailed(false); };
    if (!navigator.onLine) lost();
    window.addEventListener('offline', lost);
    window.addEventListener('physiquequest:connection-lost', lost);
    window.addEventListener('physiquequest:connection-restored', restored);
    return () => { window.removeEventListener('offline', lost); window.removeEventListener('physiquequest:connection-lost', lost); window.removeEventListener('physiquequest:connection-restored', restored); };
  }, [user]);
  const retryConnection = async () => {
    if (retrying) return;
    setRetrying(true); setRetryFailed(false);
    try { await api.getProfile(true); setConnectionLost(false); dismissedOffline.current = false; }
    catch { setRetryFailed(true); }
    finally { setRetrying(false); }
  };
  useEffect(() => { if (!user) setDismissedUser(null); }, [user]);
  useEffect(() => {
    let active = true;
    void session.restore(getApiBaseUrl()).then(() => { if (active) setReady(true); }).catch(() => { if (active) setError('Could not restore your session. Check your connection and retry.'); });
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'physiquequest-logout' || event.key === 'physiquequest-runtime-api-url') { clearAuthSession(false); window.location.assign('/'); }
      if (event.key === DATA_CHANGE_KEY && event.newValue) {
        const base = getApiBaseUrl(), owner = session.current(base);
        const resources = parseDataChange(event.newValue, owner?.id ? `${base}:${owner.id}` : null);
        if (resources) {
          deviceCache.invalidateExternal(resources);
          window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT, { detail: { resources } }));
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { active = false; window.removeEventListener('storage', onStorage); };
  }, [attempt]);
  if (!ready) return error ? <div role="alert">{error}<button type="button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Retry</button></div> : null;
  return <>{children}{user?.emailVerified === false && dismissedUser !== user.id && pathname !== '/verify-email' && <ForgotPasswordFlow mode="verify-email" accountEmail={user.email} onClose={() => setDismissedUser(user.id)} onSuccess={() => { setDismissedUser(user.id); void session.refresh(getApiBaseUrl()).catch(() => {}); }} />}{connectionLost && user && !pathname?.startsWith('/coach/session') && <OutcomeDialog kind="error" title="Connection unavailable" message={`${retryFailed ? 'Still unable to reach your account. ' : 'We could not reach PhysiqueQuest. '}You can view previously saved information when available. New workouts, meals and changes need a connection and are not queued for later.`} actionLabel={retrying ? 'Checking…' : 'Try again'} actionDisabled={retrying} onAction={() => void retryConnection()} secondaryLabel="Continue with saved content" onSecondary={() => { dismissedOffline.current = true; setConnectionLost(false); }} onClose={() => { dismissedOffline.current = true; setConnectionLost(false); }}/>}</>;
}
