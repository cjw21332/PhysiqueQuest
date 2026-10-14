'use client';

import { useEffect, useRef, useState } from 'react';
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
import TrackingSession from './TrackingSession';
import { trackingPresets, type TrackingExercise } from '../../../shared/repCounter';

type View = 'plan' | 'library' | 'camera' | 'session' | 'tracking' | 'report';

export default function CoachSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const [view, setView] = useState<View>('plan');
  const [workout, setWorkout] = useState<WorkoutSessionRecord | null>(null);
  const [trackingExercise, setTrackingExercise] = useState<TrackingExercise | null>(null);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const { startWorkout, setPaused, completeWorkout } = useWorkouts();
  const { settings } = useSettings();
  const [toast, setToast] = useState('');
  const say = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2500); };
  const goHome = () => navigate('/home');
  const startTracking = async (exercise: TrackingExercise) => {
    setTrackingBusy(true); setActionError('');
    try {
      const created = await startWorkout([exercise._id]);
      setTrackingExercise(exercise); setWorkout(created); setView('tracking');
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not start camera tracking.'); }
    finally { setTrackingBusy(false); }
  };
  const startedFromLink = useRef(false);
  useEffect(() => {
    const preset = trackingPresets.find(item => item._id === new URLSearchParams(window.location.search).get('track'));
    if (!preset || startedFromLink.current) return;
    startedFromLink.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    void startTracking(preset);
    // Start one workout even when React replays the mount effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className={`coach-section coach-view-${view}`}>
      <div className="coach-scroll">
        {view === 'plan' && <>
          <CoachPlan profile={profile} onStart={() => setView('camera')} onLibrary={() => setView('library')}/>
          <section className="camera-prototype" aria-label="Camera rep counting">
            <h3>Camera rep counting · beta</h3>
            <p>Try a squat or count curls on one arm. Review your reps before saving.</p>
            <div className="session-controls">{trackingPresets.map(exercise => <button type="button" className="secondary" disabled={trackingBusy} key={exercise._id} onClick={() => void startTracking(exercise)}>{exercise.name}</button>)}</div>
            {trackingBusy && <p role="status">Starting camera session…</p>}
          </section>
        </>}
        {view === 'library' && <ExerciseLibrary selectedEquipment={profile.equipment ?? []} onBack={() => setView('plan')}/>}
        {view === 'tracking' && workout && trackingExercise && <TrackingSession key={workout._id} exercise={trackingExercise} onPause={paused => setPaused(workout._id, paused)} onFinish={async (seconds, reps) => {
          const saved = await completeWorkout(workout._id, seconds, [{ exerciseId: trackingExercise._id, reps }]);
          setWorkout(saved); setView('report');
        }}/>}
        {view === 'camera' && <CameraCheck onBack={() => setView('plan')} onStart={async () => { setActionError(''); try { primeAlarmAudio(); const created = await startWorkout(exercises.map((_, index) => `exercise-${index + 1}`)); setWorkout(created); setView('session'); } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not start workout.'); } }}/>}
        {view === 'session' && workout && <LiveSession exercise={exercises[1]} workoutId={workout._id} thresholdSeconds={settings.threshold} contactName={profile.contactName ?? ''} contactPhone={profile.contactPhone ?? ''} onPause={async paused => { await setPaused(workout._id, paused); }} onEnd={async seconds => { const saved = await completeWorkout(workout._id, seconds); setWorkout(saved); setView('report'); }}/> }
        {view === 'report' && workout && <WorkoutReport workout={workout} onBack={() => setView('plan')} onHome={goHome} onShare={() => say('Sharing is not available in this Expo Go session.')}/>}
      </div>
      {(view === 'plan' || view === 'library') && <BottomNav />}
      {actionError && <div className="scan-warning" role="alert">{actionError}</div>}
      {toast && <div className="home-toast coach-toast" role="status">{toast}</div>}
    </section>
  );
}
