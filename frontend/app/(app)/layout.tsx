'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isAuthenticated } from '../../lib/auth';
import { api } from '../../lib/api';
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
      if (document.visibilityState === 'visible' && isAuthenticated()) void api.preloadAppData();
    };
    const endSession = () => { navigate('/launch'); };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== AUTH_STORAGE_KEY && event.key !== 'physiquequest-runtime-api-url') return;
      if (!isAuthenticated()) endSession();
      else preload();
    };
    preload();
    window.addEventListener('focus', preload);
    window.addEventListener('online', preload);
    window.addEventListener('physiquequest:session-ended', endSession);
    window.addEventListener('storage', onStorage);
    return () => {
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
  return <div className={`${theme} signed-in-layout`}>{children}{isClient && isAuthenticated() && <CoachChat />}</div>;
}
