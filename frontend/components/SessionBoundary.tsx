'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import ForgotPasswordFlow from '../sections/Forgot Password/ForgotPasswordFlow';
import { api, deviceCache, getApiBaseUrl } from '../lib/api';
import { nativeOfflineAccount } from '../lib/nativeOfflineAccount';
import OutcomeDialog from './OutcomeDialog';
import { Icon } from '../sections/Home/icons';
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
  const [onlineNotice, setOnlineNotice] = useState(false);
  const dismissedOffline = useRef(false);
  const wasOffline = useRef(false);
  const onlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (onlineTimer.current) clearTimeout(onlineTimer.current); }, []);
  useEffect(() => {
    if (!user) { setConnectionLost(false); dismissedOffline.current = false; return; }
    try { dismissedOffline.current = sessionStorage.getItem('pq-offline-dismissed') === '1'; wasOffline.current = sessionStorage.getItem('pq-was-offline') === '1'; } catch { /* Storage may be unavailable. */ }
    const lost = () => { if (onlineTimer.current) clearTimeout(onlineTimer.current); setOnlineNotice(false); wasOffline.current = true; try { sessionStorage.setItem('pq-was-offline', '1'); } catch {} if (!dismissedOffline.current) setConnectionLost(true); };
    const restored = () => {
      if (wasOffline.current) {
        setOnlineNotice(true);
        if (onlineTimer.current) clearTimeout(onlineTimer.current);
        onlineTimer.current = setTimeout(() => setOnlineNotice(false), 4000);
      }
      wasOffline.current = false; dismissedOffline.current = false;
      try { sessionStorage.removeItem('pq-was-offline'); sessionStorage.removeItem('pq-offline-dismissed'); } catch {}
      setConnectionLost(false); setRetryFailed(false);
    };
    const backendStatus = (event: Event) => { const status = (event as CustomEvent).detail; if (status === 'offline') lost(); else if (status === 'online') restored(); };
    const online = () => {
      if (session.current()?.offlineOnly) return;
      void api.getProfile(true).then(() => window.dispatchEvent(new Event('physiquequest:connection-restored'))).catch(() => {});
    };
    if (!navigator.onLine) lost();
    window.addEventListener('offline', lost);
    window.addEventListener('online', online);
    window.addEventListener('physiquequest:connection-lost', lost);
    window.addEventListener('physiquequest:connection-restored', restored);
    window.addEventListener('physiquequest:backend-status', backendStatus);
    return () => { window.removeEventListener('offline', lost); window.removeEventListener('online', online); window.removeEventListener('physiquequest:connection-lost', lost); window.removeEventListener('physiquequest:connection-restored', restored); window.removeEventListener('physiquequest:backend-status', backendStatus); };
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
    const base = getApiBaseUrl();
    void session.restore(base).then(restored => {
      if (!active) return;
      if (!restored) void nativeOfflineAccount('forget-offline-account');
      setReady(true);
    }).catch(async () => {
      const grant = await nativeOfflineAccount('restore-offline-account');
      if (!active) return;
      if (grant && session.restoreOffline(grant,base)) setReady(true);
      else setError('Could not restore your session. Check your connection and retry.');
    });
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
  useEffect(() => {
    if (!user?.id) return;
    if (user.token) {
      void nativeOfflineAccount('remember-offline-account',user.token).then(grant => {
        if (grant && session.current(getApiBaseUrl())?.id === grant.id) navigator.serviceWorker?.ready.then(reg => reg.active?.postMessage({type:'PREPARE_OFFLINE_APP'})).catch(()=>{});
      });
      return;
    }
    if (!user.offlineOnly) return;
    const retry = () => {
      if (navigator.onLine && document.visibilityState === 'visible') void session.refresh(getApiBaseUrl()).then(next => {
        if (!next) clearAuthSession();
        else window.dispatchEvent(new Event('physiquequest:connection-restored'));
      }).catch(()=>{});
    };
    const expire = window.setTimeout(() => { if (session.current()?.offlineOnly || !session.current()) clearAuthSession(); },Math.max(0,user.expiresAt-Date.now()));
    const timer = window.setInterval(retry,15000);
    window.addEventListener('online',retry);
    window.addEventListener('focus',retry);
    return () => { clearInterval(timer); clearTimeout(expire); window.removeEventListener('online',retry); window.removeEventListener('focus',retry); };
  },[user]);
  if (!ready) return error ? <div role="alert">{error}<button type="button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Retry</button></div> : null;
  const continueOffline = () => { dismissedOffline.current = true; try { sessionStorage.setItem('pq-offline-dismissed', '1'); } catch {} setConnectionLost(false); };
  return <>{children}{user?.emailVerified === false && dismissedUser !== user.id && pathname !== '/verify-email' && <ForgotPasswordFlow mode="verify-email" accountEmail={user.email} onClose={() => setDismissedUser(user.id)} onSuccess={() => { setDismissedUser(user.id); void session.refresh(getApiBaseUrl()).catch(() => {}); }} />}{connectionLost && user && !pathname?.startsWith('/coach/session') && <OutcomeDialog kind="info" title="You're offline" message={`${retryFailed ? 'Still unable to connect. ' : 'PhysiqueQuest is unavailable right now. '}Continue offline to use saved content and log manual workouts. Completed sessions sync when you reconnect. Food logging requires a connection.`} actionLabel="Continue offline" onAction={continueOffline} secondaryLabel={retrying ? 'Checking…' : 'Try again'} onSecondary={() => { if (!retrying) void retryConnection(); }} onClose={continueOffline}/>} {onlineNotice && user && <div className="connection-online-notice" role="status"><Icon name="check" size={18}/><span>You&apos;re back online</span></div>}</>;
}
