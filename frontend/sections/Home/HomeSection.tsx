'use client';

import { useState } from 'react';
import type { HomeTab } from './BottomNav';
import BottomNav from './BottomNav';
import HomeDashboard from './HomeDashboard';
import GoalsMilestones from './GoalsMilestones';
import Progress from './Progress';
import Notifications from './Notifications';
import type { Profile } from './types';
import CoachSection from '../Coach/CoachSection';
import ScanSection from '../Scan/ScanSection';
import QuestSection from '../Quests Section/QuestSection';
import MeSection from '../Me Section/MeSection';

type View = 'dashboard' | 'goals' | 'progress' | 'notifications' | 'Coach' | 'Scan' | 'Quests' | 'Me';
export default function HomeSection({ profile }: { profile: Profile }) {
  const [view, setView] = useState<View>('dashboard');
  const [tab, setTab] = useState<HomeTab>('Home');
  const [message, setMessage] = useState('');
  const open = (next: View) => { setView(next); setMessage(''); };
  const goHome = () => { setTab('Home'); open('dashboard'); };
  const changeTab = (next: HomeTab) => {
    setTab(next);
    if (next === 'Home') open('dashboard');
    else if (next === 'Quests') open('Quests');
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
    {view === 'Quests' && <QuestSection/>}
    {view === 'Me' && <MeSection profile={profile}/>}
  </div><BottomNav active={tab} onChange={changeTab}/>{message && <div className="home-toast" role="status">{message}</div>}</section>;
}
