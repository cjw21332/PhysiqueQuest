'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ScanSection from '../../../sections/Scan/ScanSection';
import LogoutModal from '../../../components/LogoutModal';
import { getCurrentUser, logout } from '../../../lib/auth';

export default function ScanPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push('/');
      return;
    }

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
        <ScanSection
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


