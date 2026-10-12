'use client';

import Progress from '../../../sections/Home/Progress';
import JourneyPageShell from '../../../sections/Home/JourneyPageShell';
import ProfileLoadState from '../../../components/ProfileLoadState';
import { useCurrentProfile } from '../../../hooks/useCurrentProfile';

export default function ProgressPage() {
  const { profile, loading, error, retry } = useCurrentProfile();

  if (loading || error || !profile) return <ProfileLoadState loading={loading} error={error} onRetry={retry} />;

  return <main className="scene">
    <div className="app-shell">
      <JourneyPageShell>
        <Progress />
      </JourneyPageShell>
    </div>
  </main>;
}
