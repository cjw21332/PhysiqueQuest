'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isAuthenticated } from '../../lib/auth';
import { navigate } from '../../lib/navigation';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return <>{children}</>;
}
