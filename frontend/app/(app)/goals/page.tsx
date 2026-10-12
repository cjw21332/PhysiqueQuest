'use client';

import GoalsMilestones from '../../../sections/Home/GoalsMilestones';
import JourneyPageShell from '../../../sections/Home/JourneyPageShell';
import ProfileLoadState from '../../../components/ProfileLoadState';
import { useCurrentProfile } from '../../../hooks/useCurrentProfile';

export default function GoalsPage() {
  const { profile, loading, error, retry } = useCurrentProfile();

  if (loading || error || !profile) return <ProfileLoadState loading={loading} error={error} onRetry={retry} />;

  return <main className="scene">
    <div className="app-shell">
      <JourneyPageShell>
        <GoalsMilestones profile={profile} />
      </JourneyPageShell>
    </div>
  </main>;
}
