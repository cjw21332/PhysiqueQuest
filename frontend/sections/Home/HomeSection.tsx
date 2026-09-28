'use client';

import { useState } from 'react';
import type { HomeTab } from './BottomNav';
import BottomNav from './BottomNav';
import HomeDashboard from './HomeDashboard';
import GoalsMilestones from './GoalsMilestones';
import Progress from './Progress';
import Notifications from './Notifications';
import { Icon } from './icons';
import type { Profile } from './types';
import CoachSection from '../Coach/CoachSection';
import ScanSection from '../Scan/ScanSection';

type View = 'dashboard' | 'goals' | 'progress' | 'notifications' | 'Coach' | 'Scan' | 'Me';
export default function HomeSection({ profile }: { profile: Profile }) {
  const [view, setView] = useState<View>('dashboard');
  const [tab, setTab] = useState<HomeTab>('Home');
  const [message, setMessage] = useState('');
  const open = (next: View) => { setView(next); setMessage(''); };
  const goHome = () => { setTab('Home'); open('dashboard'); };
  const changeTab = (next: HomeTab) => {
    setTab(next);
    if (next === 'Home') open('dashboard');
    else if (next === 'Quests') open('goals');
    else open(next);
  };
  const feedback = (value: string) => { setMessage(value); window.setTimeout(() => setMessage(''), 2600); };
  return <section className="home-section screen-enter"><div className="home-content">
    {view === 'dashboard' && <HomeDashboard profile={profile} onOpen={next => open(next)} onNotify={() => open('notifications')} onAction={feedback}/>}
    {view === 'goals' && <GoalsMilestones profile={profile} onBack={goHome}/>}
    {view === 'progress' && <Progress onBack={goHome}/>}
    {view === 'notifications' && <Notifications onBack={goHome}/>}
    {view === 'Coach' && <CoachSection profile={profile} onHome={goHome}/>}
    {view === 'Scan' && <ScanSection/>}
    {view === 'Me' && <section className="profile-view"><header className="section-page-head"><h2>My profile</h2><button className="quiet-link" onClick={() => feedback('Profile editing is coming soon.')}>Edit</button></header><div className="profile-card"><div className="avatar large">{profile.name ? profile.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : 'T'}</div><h3>{profile.name || 'Toji'}</h3><span>{profile.email || 'Athlete'}</span></div><div className="profile-row"><span>Primary goal</span><b>{profile.goal}</b></div><div className="profile-row"><span>Training session</span><b>{profile.duration}</b></div><div className="profile-row"><span>Current weight</span><b>{profile.weight || '—'} {profile.weightUnit}</b></div><button className="profile-action" onClick={() => open('goals')}>Goals & milestones <Icon name="arrow"/></button><button className="profile-action" onClick={() => open('progress')}>Progress <Icon name="arrow"/></button></section>}
  </div><BottomNav active={tab} onChange={changeTab}/>{message && <div className="home-toast" role="status">{message}</div>}</section>;
}
