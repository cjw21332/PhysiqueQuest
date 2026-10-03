'use client';

import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';
import { useActivity } from '../../hooks/useActivity';

export default function CoachPlan({ profile, onStart, onLibrary }: { profile: Profile; onStart: () => void; onLibrary: () => void }) {
  const { loading, error } = useActivity();
  void profile;
  void onStart;
  return <div className="coach-plan">
    <header className="coach-plan-header"><h2 className="coach-title">AI Coach</h2></header>
    {loading ? <div className="profile-load-state" role="status"><h2>Loading coach data…</h2></div> : error ? <div className="profile-load-state" role="alert"><h2>Could not load coach data</h2><p>{error}</p></div> : <section className="profile-empty-state" aria-live="polite">
      <h3>No workout plan saved yet</h3>
      <p>Workout plans will appear here after a real plan is created. Live pose tracking and AI form scoring are not connected in this Expo Go build.</p>
      <button className="library-link-card" onClick={onLibrary}><span className="library-icon"><Icon name="medal" size={22} /></span><span className="library-info"><span className="library-title">Exercise library</span><span className="library-subtitle">Browse available exercise guidance</span></span><Icon name="arrow" size={18} /></button>
    </section>}
  </div>;
}
