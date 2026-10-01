'use client';

import { useState } from 'react';
import BottomNav from './BottomNav';
import HomeDashboard from './HomeDashboard';
import GoalsMilestones from './GoalsMilestones';
import Progress from './Progress';
import Notifications from './Notifications';
import type { Profile } from './types';

type View = 'dashboard' | 'goals' | 'progress' | 'notifications';

export default function HomeSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const [view, setView] = useState<View>('dashboard');
  const [message, setMessage] = useState('');
  const open = (next: View) => { setView(next); setMessage(''); };
  const goHome = () => open('dashboard');
  const feedback = (value: string) => { setMessage(value); window.setTimeout(() => setMessage(''), 2600); };

  return (
    <section className="home-section screen-enter">
      <div className="home-content">
        {view === 'dashboard' && <HomeDashboard profile={profile} onOpen={next => open(next)} onNotify={() => open('notifications')} onAction={feedback}/>}
        {view === 'goals' && <div className="home-subview"><GoalsMilestones profile={profile} onBack={goHome}/></div>}
        {view === 'progress' && <div className="home-subview"><Progress onBack={goHome}/></div>}
        {view === 'notifications' && <div className="home-subview"><Notifications onBack={goHome}/></div>}
      </div>
      {view === 'dashboard' && <BottomNav />}
      {message && <div className="home-toast" role="status">{message}</div>}
    </section>
  );
}
