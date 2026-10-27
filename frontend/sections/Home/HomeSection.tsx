'use client';

import { useState } from 'react';
import BottomNav from './BottomNav';
import HomeDashboard from './HomeDashboard';
import Notifications from './Notifications';
import type { Profile } from './types';
import { useScreenRoute } from '../../hooks/useScreenRoute';

type View = 'dashboard' | 'notifications';

export default function HomeSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const [view, setView] = useScreenRoute<View>('/home', { dashboard: '', notifications: '/notifications' }, 'dashboard');
  const [message, setMessage] = useState('');
  const open = (next: View) => { setView(next); setMessage(''); };
  const goHome = () => open('dashboard');
  const feedback = (value: string) => { setMessage(value); window.setTimeout(() => setMessage(''), 2600); };

  return (
    <section className="home-section screen-enter">
      <div className="home-content">
        {view === 'dashboard' && <HomeDashboard profile={profile} onNotify={() => open('notifications')} onAction={feedback}/>}
        {view === 'notifications' && <div className="home-subview"><Notifications onBack={goHome}/></div>}
      </div>
      <BottomNav />
      {message && <div className="home-toast" role="status">{message}</div>}
    </section>
  );
}
