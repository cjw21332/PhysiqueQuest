'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import ForgotPasswordFlow from '../sections/Forgot Password/ForgotPasswordFlow';
import { deviceCache, getApiBaseUrl } from '../lib/api';
import { nativeOfflineAccount } from '../lib/nativeOfflineAccount';
import ConnectionToast from './ConnectionToast';
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
  const [sessionExpired, setSessionExpired] = useState(false);
  const [serviceReconnecting, setServiceReconnecting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [onlinePopup, setOnlinePopup] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  // Dismissed connecting/sign-in toasts stay hidden until that state ends and returns.
  const [hidden, setHidden] = useState<{ connecting?: boolean; sync?: boolean }>({});
  const dismissedOffline = useRef(false);
  const wasOffline = useRef(false);
  const onlineCheckInFlight = useRef(false);
  useEffect(() => { if (!serviceReconnecting) setHidden(current => ({ ...current, connecting: false })); }, [serviceReconnecting]);
  useEffect(() => { if (!sessionExpired) setHidden(current => ({ ...current, sync: false })); }, [sessionExpired]);
  useEffect(() => {
    if (!user) {
      setConnectionLost(false); setSessionExpired(false); setServiceReconnecting(false); setOnlinePopup(false);
      dismissedOffline.current = false; wasOffline.current = false;
      try { sessionStorage.removeItem('pq-was-offline'); sessionStorage.removeItem('pq-offline-dismissed'); } catch { /* Storage may be unavailable. */ }
      return;
    }
    setSessionExpired(Boolean(user.sessionExpired));
    try { dismissedOffline.current = sessionStorage.getItem('pq-offline-dismissed') === '1'; wasOffline.current = sessionStorage.getItem('pq-was-offline') === '1'; } catch { /* Storage may be unavailable. */ }
    const lost = (forceOffline = false) => {
      if (!forceOffline && navigator.onLine) { setServiceReconnecting(true); return; }
      setOnlinePopup(false); setServiceReconnecting(false); wasOffline.current = true;
      try { sessionStorage.setItem('pq-was-offline', '1'); } catch {}
      if (!dismissedOffline.current) setConnectionLost(true);
    };
    const internetRestored = () => {
      if (wasOffline.current) setOnlinePopup(true);
      wasOffline.current = false; dismissedOffline.current = false;
      try { sessionStorage.removeItem('pq-was-offline'); sessionStorage.removeItem('pq-offline-dismissed'); } catch {}
      setConnectionLost(false); setRetryFailed(false); setServiceReconnecting(true);
    };
    const restored = () => { setServiceReconnecting(false); setConnectionLost(false); setRetryFailed(false); };
    const backendStatus = (event: Event) => {
      const status = (event as CustomEvent).detail;
      if (status === 'offline') { if (navigator.onLine) { setServiceReconnecting(true); setConnectionLost(false); } else lost(true); }
      else if (status === 'online') { restored(); window.dispatchEvent(new Event('physiquequest:connection-restored')); }
    };
    const online = (fromNative = false) => {
      if (!fromNative && !navigator.onLine) return;
      if (onlineCheckInFlight.current) return;
      onlineCheckInFlight.current = true;
      // The operating system has reported internet connectivity. Tell the user
      // immediately; the hosted service may still need time to wake up.
      if (wasOffline.current) internetRestored();
      void (async () => {
        try {
          const base = getApiBaseUrl();
          const readyUrl = base.replace(/\/api\/?$/i, '/ready');
          const response = await fetch(readyUrl, { credentials: 'omit', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(10_000) });
          if (!response.ok || (await response.json())?.status !== 'ready') throw new Error('Service is still waking up.');
          const active = session.current();
          if (active && !active.offlineOnly) {
            const restored = await session.refresh(base);
            setSessionExpired(!restored);
          } else if (active?.offlineOnly) {
            const restored = await session.refresh(base);
            setSessionExpired(!restored);
          }
          setServiceReconnecting(false);
          setConnectionLost(false);
          window.dispatchEvent(new Event('physiquequest:connection-restored'));
        } catch {
          // Internet is back even if a free hosted service is still waking up.
          setServiceReconnecting(true);
        } finally {
          onlineCheckInFlight.current = false;
        }
      })();
    };
    const offline = () => lost(true);
    const apiConnectionLost = () => lost();
    const browserOnline = () => online();
    const onFocus = () => online();
    const internetStatus = (event: Event) => {
      const status = (event as CustomEvent).detail;
      if (status === 'offline') lost(true);
      else if (status === 'online') online(true);
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', browserOnline);
    window.addEventListener('focus', onFocus);
    window.addEventListener('physiquequest:connection-lost', apiConnectionLost);
    window.addEventListener('physiquequest:connection-restored', restored);
    window.addEventListener('physiquequest:backend-status', backendStatus);
    window.addEventListener('physiquequest:internet-status', internetStatus);
    if (!navigator.onLine) lost(true);
    else online();
    return () => { window.removeEventListener('offline', offline); window.removeEventListener('online', browserOnline); window.removeEventListener('focus', onFocus); window.removeEventListener('physiquequest:connection-lost', apiConnectionLost); window.removeEventListener('physiquequest:connection-restored', restored); window.removeEventListener('physiquequest:backend-status', backendStatus); window.removeEventListener('physiquequest:internet-status', internetStatus); };
  }, [user]);
  const retryConnection = async () => {
    if (retrying) return;
    setRetrying(true); setRetryFailed(false);
    try {
      const restored = await session.refresh(getApiBaseUrl());
      if (!restored) throw new Error('Please log in again to restore your online session.');
      setConnectionLost(false); setSessionExpired(false); dismissedOffline.current = false;
      window.dispatchEvent(new Event('physiquequest:connection-restored'));
    }
    catch { setRetryFailed(true); }
    finally { setRetrying(false); }
  };
  useEffect(() => { if (!user) setDismissedUser(null); }, [user]);
  useEffect(() => {
    let active = true;
    const base = getApiBaseUrl();
    const nativeApp = typeof window !== 'undefined' && Boolean(window.ReactNativeWebView);
    // Do not hold the mobile shell behind a network refresh. A device-bound
    // offline grant restores cached data; otherwise show login immediately.
    if (nativeApp) setReady(true);
    void (async () => {
      // Open an existing, device-bound offline session before waiting for a
      // potentially sleeping server. A server rejection still ends it.
      const grant = await nativeOfflineAccount('restore-offline-account');
      if (!active) return;
      const offline = grant && session.restoreOffline(grant, base);
      if (offline) setReady(true);
      try {
        const restored = await session.restore(base);
        if (!active) return;
        if (!restored && offline) setSessionExpired(true);
        if (!restored && !offline) void nativeOfflineAccount('forget-offline-account');
        setReady(true);
      } catch {
        if (!active) return;
        if (offline) setSessionExpired(true);
        else setError('Could not restore your session. Check your connection and retry.');
      }
    })();
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
    if (!user?.id || !user.token) return;
    void nativeOfflineAccount('remember-offline-account',user.token).then(grant => {
      if (grant && session.current(getApiBaseUrl())?.id === grant.id) navigator.serviceWorker?.ready.then(reg => reg.active?.postMessage({type:'PREPARE_OFFLINE_APP'})).catch(()=>{});
    });
  }, [user]);
  if (!ready) return error ? <div role="alert">{error}<button type="button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Retry</button></div> : null;
  const continueOffline = () => { dismissedOffline.current = true; try { sessionStorage.setItem('pq-offline-dismissed', '1'); } catch {} setConnectionLost(false); };
  const nativeApp = typeof window !== 'undefined' && Boolean(window.ReactNativeWebView);
  const inSession = Boolean(pathname?.startsWith('/coach/session'));
  // One toast at a time, in the same priority the separate notices used.
  const connectionToast = () => {
    if (onlinePopup) return <ConnectionToast key="online" tone="online" title="You’re back online" autoHideMs={5500} dismissLabel="Dismiss online message" onDismiss={() => setOnlinePopup(false)}
      message={sessionExpired ? 'Your session expired. Log in again to sync; saved data stays on this device.' : serviceReconnecting ? 'PhysiqueQuest is reconnecting. Your saved data stays available.' : 'Saved workouts can sync and online features are available.'}/>;
    if (sessionExpired && nativeApp && !hidden.sync) return <ConnectionToast key="sync" tone="sync" title="Sign in to sync" message="Your saved content and on-device workouts are available." dismissLabel="Dismiss sign-in message" onDismiss={() => setHidden(current => ({ ...current, sync: true }))}/>;
    if (connectionLost && !sessionExpired && !inSession) return <ConnectionToast key="offline" tone="offline" title="You’re offline"
      message={nativeApp ? 'Saved data may be out of date.' : `${retryFailed ? 'Still unable to connect. ' : ''}Saved content and manual workouts still work; they sync when you reconnect. Food logging needs a connection.`}
      action={{ label: 'Try again', onClick: () => { void retryConnection(); }, busy: retrying }} dismissLabel="Continue offline" onDismiss={continueOffline}/>;
    if (serviceReconnecting && nativeApp && !sessionExpired && !hidden.connecting) return <ConnectionToast key="connecting" tone="connecting" title="Connecting to PhysiqueQuest" message="You can keep using your saved content." dismissLabel="Dismiss connecting message" onDismiss={() => setHidden(current => ({ ...current, connecting: true }))}/>;
    return null;
  };
  return <>{children}{user?.emailVerified === false && dismissedUser !== user.id && pathname !== '/verify-email' && <ForgotPasswordFlow mode="verify-email" accountEmail={user.email} onClose={() => { setDismissedUser(user.id); }} onSuccess={() => { setDismissedUser(user.id); void session.refresh(getApiBaseUrl()).catch(() => {}); }} />}{user && connectionToast()}</>;
}
