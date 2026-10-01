'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '../lib/auth';

export default function RootPage() {
  const router = useRouter();
  const hasContinued = useRef(false);

  const continueToApp = useCallback(() => {
    if (hasContinued.current) return;
    hasContinued.current = true;
    router.replace(isAuthenticated() ? '/home' : '/launch');
  }, [router]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      continueToApp();
      return;
    }

    const transition = window.setTimeout(continueToApp, 4500);
    return () => window.clearTimeout(transition);
  }, [continueToApp]);

  return (
    <main className="scene splash-screen">
      <div className="splash-composition" role="img" aria-label="PhysiqueQuest, AI-assisted fitness coaching that watches your form">
        <span className="splash-halo splash-halo-outer" aria-hidden="true" />
        <span className="splash-halo splash-halo-inner" aria-hidden="true" />
        <img src="/physiquequest-icon.png" alt="" className="splash-logo" />
        <p className="splash-tagline">Fitness That Fits Your Life</p>
      </div>
    </main>
  );
}
