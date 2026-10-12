'use client';

import { useState } from 'react';
import type { Profile } from '../Home/types';
import { exercises } from './exercises';
import CoachPlan from './CoachPlan';
import ExerciseLibrary from './ExerciseLibrary';
import CameraCheck from './CameraCheck';
import LiveSession from './LiveSession';
import WorkoutReport from './WorkoutReport';
import BottomNav from '../Home/BottomNav';
import { navigate } from '../../lib/navigation';
import { useWorkouts } from '../../hooks/useWorkouts';
import { useSettings } from '../../hooks/useSettings';
import { primeAlarmAudio } from '../../lib/alarmAudio';
import type { WorkoutSessionRecord } from '../../lib/api';

type View = 'plan' | 'library' | 'camera' | 'session' | 'report';

export default function CoachSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const [view, setView] = useState<View>('plan');
  const [workout, setWorkout] = useState<WorkoutSessionRecord | null>(null);
  const [actionError, setActionError] = useState('');
  const { startWorkout, setPaused, completeWorkout } = useWorkouts();
  const { settings } = useSettings();
  const [toast, setToast] = useState('');
  const say = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2500); };
  const goHome = () => navigate('/home');

  return (
    <section className={`coach-section coach-view-${view}`}>
      <div className="coach-scroll">
        {view === 'plan' && <CoachPlan profile={profile} onStart={() => setView('camera')} onLibrary={() => setView('library')}/>}
        {view === 'library' && <ExerciseLibrary selectedEquipment={profile.equipment ?? []} onBack={() => setView('plan')}/>}
        {view === 'camera' && <CameraCheck onBack={() => setView('plan')} onStart={async () => { setActionError(''); try { primeAlarmAudio(); const created = await startWorkout(exercises.map((_, index) => `exercise-${index + 1}`)); setWorkout(created); setView('session'); } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not start workout.'); } }}/>}
        {view === 'session' && workout && <LiveSession exercise={exercises[1]} workoutId={workout._id} thresholdSeconds={settings.threshold} contactName={profile.contactName ?? ''} contactPhone={profile.contactPhone ?? ''} onPause={async paused => { await setPaused(workout._id, paused); }} onEnd={async seconds => { const saved = await completeWorkout(workout._id, seconds); setWorkout(saved); setView('report'); }}/> }
        {view === 'report' && workout && <WorkoutReport workout={workout} onBack={() => setView('plan')} onHome={goHome} onShare={() => say('Sharing is not available in this Expo Go session.')}/>}
      </div>
      {view === 'plan' && <BottomNav />}
      {actionError && <div className="scan-warning" role="alert">{actionError}</div>}
      {toast && <div className="home-toast coach-toast" role="status">{toast}</div>}
    </section>
  );
}
