'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import HomeSection from '../../../sections/Home/HomeSection';
import LogoutModal from '../../../components/LogoutModal';
import { getCurrentUser, logout } from '../../../lib/auth';
import { useCurrentProfile } from '../../../hooks/useCurrentProfile';
import ProfileLoadState from '../../../components/ProfileLoadState';

export default function HomePage() {
  const router = useRouter();
  const { profile, loading, error, retry } = useCurrentProfile();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (loading || error || !profile) return <ProfileLoadState loading={loading} error={error} onRetry={retry} />;

  return (
    <main className="scene">
      <div className="app-shell">
        <HomeSection
          profile={profile}
          onLogoutRequest={() => setShowLogoutModal(true)}
        />
        <LogoutModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
        />
      </div>
    </main>
  );
}
