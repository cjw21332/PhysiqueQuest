'use client';

import { useState } from 'react';
import CoachSection from '../../../sections/Coach/CoachSection';
import { useCurrentProfile } from '../../../hooks/useCurrentProfile';
import ProfileLoadState from '../../../components/ProfileLoadState';
import ExerciseLibrary from '../../../sections/Coach/ExerciseLibrary';
import BottomNav from '../../../sections/Home/BottomNav';

export default function CoachPage() {
  const { profile: current, loading, error, retry } = useCurrentProfile();
  const [browseLibrary, setBrowseLibrary] = useState(false);
  // Keep the open screen mounted while a profile change (e.g. new equipment) refetches, so programs update in place.
  const [last, setLast] = useState(current);
  if (current && current !== last) setLast(current);
  const profile = current ?? (loading ? last : null);

  if (browseLibrary) return <main className="scene"><div className="app-shell"><section className="coach-section coach-view-library"><div className="coach-scroll"><ExerciseLibrary onBack={() => setBrowseLibrary(false)}/></div><BottomNav coachIcon="coach-wand"/></section></div></main>;
  if (error || !profile) return <main className="scene"><div className="app-shell"><ProfileLoadState loading={loading} error={error} onRetry={retry}/><button type="button" className="primary" onClick={() => setBrowseLibrary(true)}>Browse exercise library</button></div></main>;

  return (
    <main className="scene">
      <div className="app-shell">
        <CoachSection profile={profile} />
      </div>
    </main>
  );
}
