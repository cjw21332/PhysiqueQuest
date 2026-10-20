'use client';

import './coach-reference.css';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Profile } from '../Home/types';
import CoachPlan from './CoachPlan';
import ExerciseLibrary from './ExerciseLibrary';
import CameraCheck from './CameraCheck';
import RoutineSession, { readWorkoutDraft } from './RoutineSession';
import { routineSnapshot } from './workoutRoutine';
import WorkoutReport from './WorkoutReport';
import BottomNav from '../Home/BottomNav';
import { useRouter } from 'next/navigation';
import { useWorkouts } from '../../hooks/useWorkouts';
import { useSettings } from '../../hooks/useSettings';
import { primeAlarmAudio } from '../../lib/alarmAudio';
import { createRequestKey } from '../../lib/requestKey';
import { api, type WorkoutSessionRecord, type CoachExercise } from '../../lib/api';

type View = 'plan' | 'library' | 'camera' | 'session' | 'report';

export default function CoachSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const { push: navigate } = useRouter();
  const [view, setView] = useState<View>('plan');
  const [sessionExercises, setSessionExercises] = useState<CoachExercise[]>([]);
  const [sessionTitle, setSessionTitle] = useState('Workout session');
  const [workout, setWorkout] = useState<WorkoutSessionRecord | null>(null);
  const [actionError, setActionError] = useState('');
  const [recoverable, setRecoverable] = useState<WorkoutSessionRecord | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkFailed, setCheckFailed] = useState(false);
  const starting = useRef(false);
  const startAttempt = useRef<{ requestKey: string; startedAt: string } | null>(null);
  const recoveryRequest = useRef(0);
  const refreshRecovery = useCallback(async () => {
    const request = ++recoveryRequest.current;
    setChecking(true); setCheckFailed(false);
    try {
      const candidate = await api.getActiveWorkout();
      const saved = candidate?._id && candidate.status === 'active' ? await api.getWorkout(candidate._id) : null;
      if (request !== recoveryRequest.current) return;
      setRecoverable(saved?.status === 'active' ? saved : null);
    } catch {
      if (request === recoveryRequest.current) { setRecoverable(null); setCheckFailed(true); }
    } finally { if (request === recoveryRequest.current) setChecking(false); }
  }, []);
  useEffect(() => {
    if (view !== 'plan') return;
    void refreshRecovery();
    const refresh = () => { if (document.visibilityState === 'visible') void refreshRecovery(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      recoveryRequest.current++;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [view, refreshRecovery]);
  const { startWorkout } = useWorkouts();
  const { settings } = useSettings();
  const [toast, setToast] = useState('');
  const say = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2500); };
  const goHome = () => navigate('/home');

  return (
    <section className={`coach-section coach-view-${view} ${view === 'plan' ? 'coach-reference' : ''}`}>
      <div className="coach-scroll">
        {view === 'plan' && <>
          {recoverable && !checking && <section className="routine-recovery"><h2>Workout in progress</h2><p>Saved sets are on your account. Resume paused; unsaved inputs are restored only on this device. Without a device checkpoint, elapsed time includes the gap while the app was closed.</p><button type="button" disabled={starting.current} onClick={async()=>{
            if(starting.current)return;starting.current=true;setActionError('');
            try { let saved=await api.getWorkout(recoverable._id);if(saved.status!=='active'){setRecoverable(null);return;}
              if(!saved.pausedAt){const checkpoint=readWorkoutDraft(saved._id).checkpoint;const pauseTime=Math.min(Date.now(),Math.max(Date.parse(saved.startedAt),checkpoint?Date.parse(checkpoint):Date.now()));saved=await api.pauseWorkout(saved._id,{paused:true,occurredAt:new Date(pauseTime).toISOString(),expectedRevision:saved.revision??0});}
              setWorkout(saved);setView('session');setSessionTitle('Resumed workout');
            }catch(err){setActionError(err instanceof Error?err.message:'Could not restore workout. Try again.');}finally{starting.current=false;}
          }}>Resume saved workout</button></section>}
          {checkFailed && <p role="alert">Could not check for an existing workout. <button type="button" onClick={()=>void refreshRecovery()}>Retry workout recovery</button></p>}
          <CoachPlan profile={profile} onStart={(selected, title) => { if(checking || checkFailed || recoverable){setActionError(recoverable?'Resume your existing workout before starting another.':'Wait for workout recovery or retry the check before starting.');return;}startAttempt.current=null;setSessionExercises(selected); setSessionTitle(title || 'Workout session'); setView('camera'); }} onLibrary={() => setView('library')}/>
        </>}
        {view === 'library' && <>
          <ExerciseLibrary selectedEquipment={profile.equipment ?? []} onBack={() => setView('plan')}/>
        </>}
        {view === 'camera' && <CameraCheck onBack={() => setView('plan')} onStart={async () => { if(starting.current)return;starting.current=true;setActionError(''); try { if (!sessionExercises.length) throw new Error('Select a program with available exercises first.'); primeAlarmAudio();startAttempt.current??={requestKey:createRequestKey(),startedAt:new Date().toISOString()}; const created = await startWorkout(sessionExercises.map(exercise => exercise.exerciseId),routineSnapshot(sessionExercises),startAttempt.current.requestKey,startAttempt.current.startedAt); setWorkout(created); setView('session'); } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not start workout.'); }finally{starting.current=false;} }}/>}
        {view === 'session' && workout && <RoutineSession workout={workout} thresholdSeconds={settings.threshold} contactName={profile.contactName??''} contactPhone={profile.contactPhone??''} onSaved={setWorkout} onComplete={saved=>{setWorkout(saved);setRecoverable(null);setView('report');}}/>}
        {view === 'report' && workout && <WorkoutReport workout={workout} title={sessionTitle} exercises={sessionExercises} onBack={() => setView('plan')} onHome={goHome} onShare={() => say('Sharing is not available in this Expo Go session.')}/>}
      </div>
      {(view === 'plan' || view === 'library') && <BottomNav coachIcon="coach-wand" />}
      {actionError && <div className="scan-warning" role="alert">{actionError}</div>}
      {toast && <div className="home-toast coach-toast" role="status">{toast}</div>}
    </section>
  );
}
