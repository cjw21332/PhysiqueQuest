'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isAuthenticated } from '../../lib/auth';
import { api, deviceCache } from '../../lib/api';
import { AUTH_STORAGE_KEY } from '../../lib/session';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { push: navigate } = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const [cacheNotice, setCacheNotice] = useState('');

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
      const resources = (['profile', 'nutrition', 'activity', 'coach'] as const).map(key => ({ key, ...deviceCache.get(key) }));
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

  const darkPage = ['/home', '/goals', '/progress', '/coach'].includes(pathname);
  const theme = pathname === '/coach'
    ? 'coach-dark-theme'
    : pathname === '/scan'
      ? 'scan-dark-theme'
      : pathname === '/quests' || pathname === '/me'
        ? 'account-dark-theme'
      : darkPage
        ? 'journey-dark-theme'
        : 'system-dark-theme';
  return <div className={`${theme} signed-in-layout`}>{cacheNotice && <div className="cache-notice" role="status">{cacheNotice} <button type="button" onClick={() => void api.preloadAppData(true)}>Refresh</button></div>}{children}</div>;
}
