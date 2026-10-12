'use client';

import type { ReactNode } from 'react';
import BottomNav from './BottomNav';

export default function JourneyPageShell({ children }: { children: ReactNode }) {
  return <section className="home-section screen-enter">
    <div className="home-content">{children}</div>
    <BottomNav />
  </section>;
}
