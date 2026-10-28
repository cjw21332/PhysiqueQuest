'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isAuthenticated } from '../../lib/auth';
import { api, deviceCache } from '../../lib/api';
import { AUTH_STORAGE_KEY } from '../../lib/session';
import CoachChat from '../../components/CoachChat';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { push: navigate } = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const [cacheNotice, setCacheNotice] = useState('');
  const retryCache = () => {
    void Promise.allSettled([
      api.preloadAppData(true),
      ...(['notifications', 'progress:weight', 'progress:waist', 'progress:benchPress', 'workouts'] as const)
        .filter(key => deviceCache.get(key).error)
        .map(key => key === 'notifications' ? api.getNotifications(true) : key === 'workouts' ? api.getWorkouts(20, true) : api.getProgress(key.slice('progress:'.length), 90, true)),
    ]);
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !isAuthenticated() && pathname !== '/') {
      navigate('/launch');
    }
  }, [isClient, pathname]);

  useEffect(() => {
    const update = () => {
      const resources = (['profile', 'nutrition', 'activity', 'coach', 'notifications', 'progress:weight', 'progress:waist', 'progress:benchPress', 'workouts'] as const).map(key => ({ key, ...deviceCache.get(key) }));
      const saved = resources.filter(resource => resource.data !== undefined);
      const failed = resources.filter(resource => resource.error);
      setCacheNotice(failed.length
        ? `Could not refresh ${failed.map(resource => resource.key).join(', ')}. ${saved.length ? 'Showing available saved data. ' : ''}${failed[0].error}`
        : saved.some(resource => resource.refreshing) ? 'Showing saved data while checking for updates…' : '');
    };
    const preload = () => {
      if (document.visibilityState === 'visible' && isAuthenticated()) void api.preloadAppData();
    };
    const endSession = () => { update(); navigate('/launch'); };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== AUTH_STORAGE_KEY && event.key !== 'physiquequest-runtime-api-url') return;
      if (!isAuthenticated()) endSession();
      else { update(); preload(); }
    };
    const unsubscribe = deviceCache.subscribe(update);
    preload();
    window.addEventListener('focus', preload);
    window.addEventListener('online', preload);
    window.addEventListener('physiquequest:session-ended', endSession);
    window.addEventListener('storage', onStorage);
    return () => {
      unsubscribe();
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
  return <div className={`${theme} signed-in-layout`}>{cacheNotice && <div className="cache-notice" role="status">{cacheNotice} <button type="button" onClick={retryCache}>Refresh</button></div>}{children}{isClient && isAuthenticated() && <CoachChat />}</div>;
}
