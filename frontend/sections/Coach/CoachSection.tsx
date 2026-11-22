'use client';

import './coach-reference.css';
import './manual-session.css';

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
import { useSettings } from '../../hooks/useSettings';
import { createRequestKey } from '../../lib/requestKey';
import { api, type WorkoutSessionRecord, type CoachExercise } from '../../lib/api';
import { useScreenRoute } from '../../hooks/useScreenRoute';
import SessionChoice from './SessionChoice';
import OutcomeDialog from '../../components/OutcomeDialog';

type View = 'plan' | 'library' | 'review' | 'session' | 'report';

export default function CoachSection({ profile }: { profile: Profile }) {
  const { push: navigate } = useRouter();
  const [view, setView] = useScreenRoute<View>('/coach', { plan: '', library: '/library', review: '/review', session: '/session', report: '/report' }, 'plan');
  const [sessionExercises, setSessionExercises] = useState<CoachExercise[]>([]);
  const [sessionTitle, setSessionTitle] = useState('Workout session');
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [sessionMode, setSessionMode] = useState<'manual'>('manual');
  const [startingSession, setStartingSession] = useState(false);
  const [workout, setWorkout] = useState<WorkoutSessionRecord | null>(null);
  const [actionError, setActionError] = useState('');
  const [recoverable, setRecoverable] = useState<WorkoutSessionRecord | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkFailed, setCheckFailed] = useState(false);
  const starting = useRef(false);
  const startAttempt = useRef<{ requestKey: string; startedAt: string } | null>(null);
  const recoveryRequest = useRef(0);
  useEffect(() => {
    if (view === 'session' && workout?.status === 'completed') { window.history.replaceState(null, '', '/coach/report'); return; }
    if ((view !== 'session' && view !== 'report') || workout) return;
    let active = true;
    let id: string | null = null;
    try { if (view === 'report') id = sessionStorage.getItem('physiquequest-last-workout-report'); } catch { /* Storage may be unavailable. */ }
    const request = id ? api.getWorkout(id) : view === 'session' ? api.getActiveWorkout() : api.latestLocalReport();
    void request.then(saved => {
      if (!active) return;
      if (saved && saved.status === (view === 'report' ? 'completed' : 'active')) { setSessionMode('manual'); setWorkout(saved); setSessionTitle(saved.routineName || 'Workout session'); }
      else window.history.replaceState(null, '', '/coach');
    }).catch(() => { if (active) { setActionError('Could not load your workout. Please try again.'); window.history.replaceState(null, '', '/coach'); } });
    return () => { active = false; };
  }, [view, workout, sessionExercises.length]);
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
    if (view !== 'plan' && view !== 'library' && view !== 'review') return;
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
  const { settings } = useSettings();
  const [toast, setToast] = useState('');
  const say = (message: string) => { setToast(message); };
  const goHome = () => navigate('/home');
  const startSession = async (selected = sessionExercises, title = sessionTitle) => {
    if (starting.current) return;
    starting.current = true; setStartingSession(true); setActionError('');
    try {
      if (!selected.length) throw new Error('Select a program with available exercises first.');
      startAttempt.current ??= { requestKey: createRequestKey(), startedAt: new Date().toISOString() };
      const created = await api.startManualWorkout({kind:'create',data:{...startAttempt.current, exerciseIds:selected.map(row => row.exerciseId), exercises:routineSnapshot(selected),routineName:title,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}});
      setSessionMode('manual'); setWorkout(created); setChoiceOpen(false); setView('session');
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not start workout.'); }
    finally { starting.current = false; setStartingSession(false); }
  };
  const chooseSession = () => { void startSession(); };

  return (
    <section className={`coach-section coach-view-${view} ${view === 'plan' ? 'coach-reference' : ''}`}>
      <div className="coach-scroll">
        {view === 'plan' && <>
          {recoverable && !checking && <section className="routine-recovery"><h2>Workout in progress</h2><p>Resume your saved sets. Resume paused; unsaved inputs are restored only on this device. Without a device checkpoint, elapsed time includes the gap while the app was closed.</p><button type="button" disabled={starting.current} onClick={async()=>{
            if(starting.current)return;starting.current=true;setActionError('');
            try { let saved=await api.getWorkout(recoverable._id);if(saved.status!=='active'){setRecoverable(null);return;}
              if(!saved.pausedAt){const checkpoint=readWorkoutDraft(saved._id).checkpoint;const pauseTime=Math.min(Date.now(),Math.max(Date.parse(saved.startedAt),checkpoint?Date.parse(checkpoint):Date.now()));saved=await api.pauseWorkout(saved._id,{paused:true,occurredAt:new Date(pauseTime).toISOString(),expectedRevision:saved.revision??0});}
              setSessionMode('manual');
              setWorkout(saved);setView('session');setSessionTitle(saved.routineName || 'Workout session');
            }catch(err){setActionError(err instanceof Error?err.message:'Could not restore workout. Try again.');}finally{starting.current=false;}
          }}>Resume saved workout</button></section>}
          {checkFailed && <p role="alert">Could not check for an existing workout. <button type="button" onClick={()=>void refreshRecovery()}>Retry workout recovery</button></p>}
          <CoachPlan profile={profile} onStart={(selected, title) => { if(checking || checkFailed || recoverable){setActionError(recoverable?'Resume your existing workout before starting another.':'Wait for workout recovery or retry the check before starting.');return;}startAttempt.current=null;setSessionExercises(selected); setSessionTitle(title || 'Workout session'); setChoiceOpen(true); }} onLibrary={() => setView('library')}/>
        </>}
        {view === 'library' && <>
          <ExerciseLibrary selectedEquipment={profile.equipment ?? []} onBack={() => setView('plan')} onStartPersonal={(item, mode) => { if(checking || checkFailed || recoverable){setActionError(recoverable?'Resume your existing workout before starting another.':'Wait for workout recovery or retry the check before starting.');return;} startAttempt.current=null; const selected: CoachExercise[] = [{ exerciseId:item._id, name:item.name, group:item.targetMuscle, targetMuscle:item.targetMuscle, equipment:item.equipment, tracking:'Manual', prescription:'1 × 10' }]; setSessionExercises(selected); setSessionTitle(item.name); if (mode === 'upload') setView('review'); else void startSession(selected, item.name); }}/>
        </>}
        {view === 'review' && <CameraCheck onBack={() => setView('library')} onStart={() => void startSession()}/>}
        {view === 'session' && workout?.status === 'active' && <RoutineSession title={sessionTitle} onCancel={() => { setWorkout(null); setRecoverable(null); setView('plan'); }} mode={sessionMode} workout={workout} thresholdSeconds={settings.threshold} contactName={profile.contactName??''} contactPhone={profile.contactPhone??''} onSaved={setWorkout} onComplete={saved=>{setWorkout(saved);setRecoverable(null);try { sessionStorage.setItem('physiquequest-last-workout-report', saved._id); } catch {} setView('report');}}/>}
        {view === 'report' && workout?.status === 'completed' && <WorkoutReport workout={workout} title={workout.routineName || sessionTitle} exercises={sessionExercises} onBack={() => setView('plan')} onHome={goHome} onShare={() => say('Sharing is not available yet.')}/>}
      </div>
      {(view === 'plan' || view === 'library') && <BottomNav coachIcon="coach-wand" />}
      {choiceOpen && <SessionChoice busy={startingSession} error={actionError} onClose={() => { setChoiceOpen(false); setActionError(''); }} onChoose={chooseSession} onReviewVideo={() => { setChoiceOpen(false); setView('review'); }} />}
      {actionError && !choiceOpen && <OutcomeDialog kind="error" title="Workout unavailable" message={actionError} onClose={() => setActionError('')} actionLabel="OK"/>}
      {toast && <OutcomeDialog kind="info" title="Sharing unavailable" message={toast} onClose={() => setToast('')}/>}
    </section>
  );
}
