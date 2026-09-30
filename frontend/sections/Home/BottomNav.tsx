'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Icon } from './icons';

export type HomeTab = 'Home' | 'Coach' | 'Scan' | 'Quests' | 'Me';

const tabs: { label: HomeTab; icon: string; path: string }[] = [
  { label: 'Home', icon: 'home', path: '/home' },
  { label: 'Coach', icon: 'coach', path: '/coach' },
  { label: 'Scan', icon: 'scan', path: '/scan' },
  { label: 'Quests', icon: 'trophy', path: '/quests' },
  { label: 'Me', icon: 'user', path: '/me' }
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <nav className="home-bottom-nav" aria-label="Main navigation">
      {tabs.map(tab => (
        <button
          key={tab.label}
          className={pathname === tab.path ? 'active' : ''}
          onClick={() => handleNavigation(tab.path)}
        >
          <span className="nav-icon">
            <Icon name={tab.icon} size={17}/>
          </span>
          <small>{tab.label}</small>
        </button>
      ))}
    </nav>
  );
}
