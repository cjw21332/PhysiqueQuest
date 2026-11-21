'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isAuthenticated } from '../../lib/auth';
import { api } from '../../lib/api';
import { AUTH_STORAGE_KEY, session } from '../../lib/session';
import { prepareExerciseCatalog } from '../../lib/prepareExerciseCatalog';
import { ConnectionContext } from '../../hooks/useBackendConnection';
import BottomNav from '../../sections/Home/BottomNav';
import CoachChat from '../../components/CoachChat';
import OfflineLeaderboard from '../../sections/Quests Section/OfflineLeaderboard';
import BadgeCelebrations from '../../components/BadgeCelebrations';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { push: navigate } = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  const [connected,setConnected] = useState(true);
  useEffect(() => {
    const lost = () => setConnected(false);
    const restored = () => setConnected(navigator.onLine);
    const native = (event: Event) => setConnected((event as CustomEvent).detail === 'online' && navigator.onLine);
    if (!navigator.onLine || session.current()?.offlineOnly) lost();
    window.addEventListener('offline',lost);
    window.addEventListener('physiquequest:connection-lost',lost);
    window.addEventListener('physiquequest:connection-restored',restored);
    window.addEventListener('physiquequest:backend-status',native);
    return () => {
      window.removeEventListener('offline',lost);
      window.removeEventListener('physiquequest:connection-lost',lost);
      window.removeEventListener('physiquequest:connection-restored',restored);
      window.removeEventListener('physiquequest:backend-status',native);
    };
  },[]);
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !isAuthenticated() && pathname !== '/') {
      navigate('/launch');
    }
  }, [isClient, pathname]);

  useEffect(() => {
    const preload = () => {
      if (document.visibilityState === 'visible' && isAuthenticated()) {
        void api.preloadAppData();
        void prepareExerciseCatalog().catch(() => {});
      }
    };
    const endSession = () => { navigate('/launch'); };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== AUTH_STORAGE_KEY && event.key !== 'physiquequest-runtime-api-url') return;
      if (!isAuthenticated()) endSession();
      else preload();
    };
    const sync = () => { if (isAuthenticated() && document.visibilityState === 'visible') void api.syncManualWorkouts().catch(() => {}); };
    const timer = window.setInterval(sync, 30000);
    window.addEventListener('online', sync);
    window.addEventListener('physiquequest:connection-restored', sync);
    window.addEventListener('focus', sync);
    sync();
    preload();
    window.addEventListener('focus', preload);
    window.addEventListener('online', preload);
    window.addEventListener('physiquequest:session-ended', endSession);
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', sync);
      window.removeEventListener('physiquequest:connection-restored', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('focus', preload);
      window.removeEventListener('online', preload);
      window.removeEventListener('physiquequest:session-ended', endSession);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const inSection = (section: string) => pathname === section || pathname.startsWith(`${section}/`);
  const darkPage = ['/home', '/goals', '/progress', '/coach'].some(inSection);
  const theme = inSection('/coach')
    ? 'coach-dark-theme'
    : inSection('/scan')
      ? 'scan-dark-theme'
      : inSection('/quests') || inSection('/me')
        ? 'account-dark-theme'
      : darkPage
        ? 'journey-dark-theme'
        : 'system-dark-theme';
  const offlineLeaderboard = !connected && pathname === '/quests/leaderboard';
  const blocked = !connected && ['/home/notifications','/coach/prepare','/scan/add-food','/scan/review','/scan/edit-meal'].includes(pathname);
  return <ConnectionContext.Provider value={connected}><div className={`${theme} signed-in-layout`}> {offlineLeaderboard ? <OfflineLeaderboard /> : blocked ? <main className="app-shell"><p role="status">This page requires a connection.</p><BottomNav/></main> : children}{connected && isClient && isAuthenticated() && <><CoachChat /><BadgeCelebrations /></>}</div></ConnectionContext.Provider>;
}
