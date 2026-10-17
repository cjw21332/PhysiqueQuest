'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isAuthenticated } from '../../lib/auth';
import { navigate, registerNavigation } from '../../lib/navigation';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { registerNavigation(path => router.push(path)); return () => registerNavigation(null); }, [router]);
  useEffect(() => { const cleared = () => router.replace('/launch'); window.addEventListener('physiquequest:session-cleared', cleared); return () => window.removeEventListener('physiquequest:session-cleared', cleared); }, [router]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !isAuthenticated() && pathname !== '/') {
      navigate('/launch');
    }
  }, [isClient, pathname]);

  return <>{children}</>;
}
