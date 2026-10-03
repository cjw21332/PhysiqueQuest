'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HomeSection from '../../../sections/Home/HomeSection';
import LogoutModal from '../../../components/LogoutModal';
import { getCurrentUser, logout } from '../../../lib/auth';

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push('/');
      return;
    }

    // Load profile from localStorage
    try {
      const savedProfile = localStorage.getItem('physiquequest-profile');
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      }
    } catch {
      setProfile({});
    }
  }, [router]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!profile) return null;

  return (
    <>
        <HomeSection
          profile={profile}
          onLogoutRequest={() => setShowLogoutModal(true)}
        />
        <LogoutModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
        />
      </>
  );
}


