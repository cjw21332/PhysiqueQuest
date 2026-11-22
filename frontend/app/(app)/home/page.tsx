'use client';

import HomeSection from '../../../sections/Home/HomeSection';
import { useCurrentProfile } from '../../../hooks/useCurrentProfile';
import ProfileLoadState from '../../../components/ProfileLoadState';

export default function HomePage() {
  const { profile, loading, error, retry } = useCurrentProfile();
  if (loading || error || !profile) return <ProfileLoadState loading={loading} error={error} onRetry={retry} />;

  return (
    <main className="scene">
      <div className="app-shell">
        <HomeSection profile={profile} />
      </div>
    </main>
  );
}
