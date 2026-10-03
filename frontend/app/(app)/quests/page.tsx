'use client';

import { useState } from 'react';
import QuestSection from '../../../sections/Quests Section/QuestSection';
import LogoutModal from '../../../components/LogoutModal';
import { getCurrentUser, logout } from '../../../lib/auth';
import { useCurrentProfile } from '../../../hooks/useCurrentProfile';
import ProfileLoadState from '../../../components/ProfileLoadState';
import { navigate } from '../../../lib/navigation';

export default function QuestsPage() {
  const { profile, loading, error, retry } = useCurrentProfile();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading || error || !profile) return <ProfileLoadState loading={loading} error={error} onRetry={retry} />;

  return (
    <main className="scene">
      <div className="app-shell">
        <QuestSection
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
