'use client';

import { usePathname } from 'next/navigation';
import { Icon } from './icons';
import { navigate } from '../../lib/navigation';

export type HomeTab = 'Home' | 'Coach' | 'Scan' | 'Quests' | 'Me';

const tabs: { label: HomeTab; icon: string; path: string }[] = [
  { label: 'Home', icon: 'home', path: '/home' },
  { label: 'Coach', icon: 'coach', path: '/coach' },
  { label: 'Scan', icon: 'scan', path: '/scan' },
  { label: 'Quests', icon: 'trophy', path: '/quests' },
  { label: 'Me', icon: 'user', path: '/me' }
];

export default function BottomNav({ coachIcon = 'coach' }: { coachIcon?: string } = {}) {
  const pathname = usePathname();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <nav className="home-bottom-nav" aria-label="Main navigation">
      {tabs.map(tab => (
        <button
          key={tab.label}
          className={pathname === tab.path || (tab.path === '/home' && ['/goals', '/progress'].includes(pathname)) || (tab.path === '/coach' && (pathname === '/exercises' || pathname.startsWith('/workouts/'))) ? 'active' : ''}
          onClick={() => handleNavigation(tab.path)}
        >
          <span className="nav-icon">
            <Icon name={tab.label === 'Coach' ? coachIcon : tab.icon} size={17}/>
          </span>
          <small>{tab.label}</small>
        </button>
      ))}
    </nav>
  );
}
