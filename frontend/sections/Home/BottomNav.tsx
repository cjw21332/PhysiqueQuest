'use client';

import { Icon } from './icons';
export type HomeTab = 'Home' | 'Coach' | 'Scan' | 'Quests' | 'Me';
const tabs: { label: HomeTab; icon: string }[] = [{ label: 'Home', icon: 'home' }, { label: 'Coach', icon: 'coach' }, { label: 'Scan', icon: 'scan' }, { label: 'Quests', icon: 'trophy' }, { label: 'Me', icon: 'user' }];
export default function BottomNav({ active, onChange }: { active: HomeTab; onChange: (tab: HomeTab) => void }) {
  return <nav className="home-bottom-nav" aria-label="Main navigation">{tabs.map(tab => <button key={tab.label} className={active === tab.label ? 'active' : ''} onClick={() => onChange(tab.label)}><span className="nav-icon"><Icon name={tab.icon} size={17}/></span><small>{tab.label}</small></button>)}</nav>;
}
