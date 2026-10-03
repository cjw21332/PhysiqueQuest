'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '../lib/auth';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    if (isAuthenticated()) {
      router.push('/home');
    } else {
      // Show launch screen
      router.push('/launch');
    }
  }, [router]);

  return (
    <main className="scene">
      <div className="app-shell">
        <div className="launch">Loading...</div>
      </div>
    </main>
  );
}
