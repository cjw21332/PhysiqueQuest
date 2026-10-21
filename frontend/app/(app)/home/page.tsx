'use client';

import { useState } from 'react';
import HomeSection from '../../../sections/Home/HomeSection';
import LogoutModal from '../../../components/LogoutModal';
import { getCurrentUser, logout } from '../../../lib/auth';
import { useCurrentProfile } from '../../../hooks/useCurrentProfile';
import ProfileLoadState from '../../../components/ProfileLoadState';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { push: navigate } = useRouter();
  const { profile, loading, error, retry } = useCurrentProfile();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
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
