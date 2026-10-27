'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from './icons';

export type HomeTab = 'Home' | 'Coach' | 'Scan' | 'Quests' | 'Me';

const tabs: { label: HomeTab; icon: string; path: string }[] = [
  { label: 'Home', icon: 'home', path: '/home' },
  { label: 'Coach', icon: 'coach', path: '/coach' },
  { label: 'Scan', icon: 'scan', path: '/scan' },
  { label: 'Quests', icon: 'trophy', path: '/quests' },
  { label: 'Me', icon: 'user', path: '/me' }
];
const accessibleLabels: Record<HomeTab, string> = { Home: 'Home', Coach: 'Coach', Scan: 'Scan food and nutrition', Quests: 'Quests', Me: 'Me, account and settings' };

export default function BottomNav({ coachIcon = 'coach' }: { coachIcon?: string } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { tabs.forEach(tab => router.prefetch(tab.path)); }, [router]);

  const handleNavigation = (path: string) => {
    if (path !== pathname) router.push(path);
  };

  return (
    <nav className="home-bottom-nav" aria-label="Main navigation">
      {tabs.map(tab => (
        <button
          type="button"
          key={tab.label}
          className={pathname === tab.path || pathname.startsWith(`${tab.path}/`) || (tab.path === '/home' && ['/goals', '/progress'].includes(pathname)) || (tab.path === '/coach' && pathname === '/exercises') ? 'active' : ''}
          aria-label={accessibleLabels[tab.label]}
          aria-current={pathname === tab.path || pathname.startsWith(`${tab.path}/`) || (tab.path === '/home' && ['/goals', '/progress'].includes(pathname)) || (tab.path === '/coach' && pathname === '/exercises') ? 'page' : undefined}
          onClick={() => handleNavigation(tab.path)}
        >
          <span className="nav-icon" aria-hidden="true">
            <Icon name={tab.label === 'Coach' ? coachIcon : tab.icon} size={17}/>
          </span>
          <small>{tab.label}</small>
        </button>
      ))}
    </nav>
  );
}
