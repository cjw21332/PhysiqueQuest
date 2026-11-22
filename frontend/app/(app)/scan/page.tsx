'use client';

import ScanSection from '../../../sections/Scan/ScanSection';
import { useCurrentProfile } from '../../../hooks/useCurrentProfile';
import ProfileLoadState from '../../../components/ProfileLoadState';

export default function ScanPage() {
  const { profile, loading, error, retry } = useCurrentProfile();
  if (loading || error || !profile) return <ProfileLoadState loading={loading} error={error} onRetry={retry} />;

  return (
    <main className="scene">
      <div className="app-shell">
        <ScanSection profile={profile} />
      </div>
    </main>
  );
}
