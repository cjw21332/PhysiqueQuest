'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '../../lib/auth';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated() && pathname !== '/') {
      router.push('/');
    }
  }, [pathname, router]);

  return <>{children}</>;
}
