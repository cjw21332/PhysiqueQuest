'use client';

import './coach-reference.css';

import { useState, useEffect, useRef } from 'react';
import type { Profile } from '../Home/types';
import CoachPlan from './CoachPlan';
import ExerciseLibrary from './ExerciseLibrary';
import CameraCheck from './CameraCheck';
import BottomNav from '../Home/BottomNav';
import { navigate } from '../../lib/navigation';
import { useWorkouts } from '../../hooks/useWorkouts';
import { primeAlarmAudio } from '../../lib/alarmAudio';
import { api, type CoachExercise } from '../../lib/api';
import { activityDate, calendarWeekday, expectedSets, shiftCalendarDate, workoutCalendarDate, type WorkoutExercise } from '../../../shared/workouts';
import { operationKey } from '../../lib/operationKey';
import { accountScope, useApiResource, notifyDataChanged } from '../../hooks/useApiResource';
import WorkoutHistory from './WorkoutHistory';
import { useWorkoutDay } from '../../hooks/useWorkoutDay';
import { useCoachPlan } from '../../hooks/useCoachPlan';

type View = 'plan' | 'library' | 'camera';

export default function CoachSection({ profile, onLogoutRequest: _onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const [view, setView] = useState<View>('plan');
  const [sessionExercises, setSessionExercises] = useState<CoachExercise[]>([]);
  const [actionError, setActionError] = useState('');
  const { createSession } = useWorkouts();
  const startIntent = useRef<{ exercises: WorkoutExercise[]; key: string; startedAt: string; context?: { programVersion?: string; dayIndex?: number; scheduledDate?: string } } | null>(null);
  const [pendingRecording, setPendingRecording] = useState<Parameters<typeof api.saveRecordedWorkout>[0] | null>(null);
  const [pendingStart, setPendingStart] = useState(false);
  const active = useApiResource('workouts', () => api.getActiveWorkout());
  const [selectedDate, setSelectedDate] = useState(() => activityDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone));
  const dayWorkouts = useWorkoutDay(selectedDate);
  const { plan } = useCoachPlan(profile as unknown as Record<string, unknown>);
  const selectedPlan = plan?.days.find(day => day.index === calendarWeekday(selectedDate));
  const recordingPlan = plan?.programVersion && selectedPlan?.isWorkoutDay && selectedPlan.exercises.length ? {
    programVersion: plan.programVersion, dayIndex: selectedPlan.index, scheduledDate: selectedDate,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    exercises: selectedPlan.exercises.map(exercise => ({ exerciseId: exercise.exerciseId, name: exercise.name,
      equipment: exercise.equipment, prescription: exercise.prescription || plan.sets, sets: expectedSets(exercise.prescription || plan.sets) })),
  } : undefined;
  useEffect(() => {
    try { setPendingRecording(JSON.parse(localStorage.getItem(`physiquequest-draft:${accountScope()}:recorded`) || 'null')); startIntent.current = JSON.parse(localStorage.getItem(`physiquequest-draft:${accountScope()}:start`) || 'null'); setPendingStart(!!startIntent.current); } catch { /* Optional recovery metadata. */ }
  }, []);
  const selectedContext = useRef<{ programVersion?: string; dayIndex?: number; scheduledDate?: string }>({});

  return (
    <section className={`coach-section coach-view-${view} ${view === 'plan' ? 'coach-reference' : ''}`}>
      <div className="coach-scroll">
        {view === 'plan' && <>
          {pendingStart && <p>A previous start was not confirmed. <button onClick={() => setView('camera')}>Retry starting saved selection</button></p>}
          <CoachPlan profile={profile} workouts={dayWorkouts.data} progressLoading={dayWorkouts.loading} progressError={dayWorkouts.error} selectedDate={selectedDate} onSelectedDayChange={dayIndex => { const today = activityDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone); setSelectedDate(shiftCalendarDate(today, dayIndex - calendarWeekday(today))); }} onStart={(selected, context) => { const existing = dayWorkouts.data?.find(workout => workout.origin === 'planned' && workout.status === 'active' && workout.programVersion === context?.programVersion && workout.dayIndex === context?.dayIndex); if (existing) { primeAlarmAudio(); navigate(`/workouts/${existing._id}`); return; } if (startIntent.current) { setActionError('Retry the saved selection before starting a different workout.'); return; } selectedContext.current = context ?? {}; setSessionExercises(selected); setView('camera'); }} onLibrary={() => setView('library')}/>
          {active.data && workoutCalendarDate(active.data, Intl.DateTimeFormat().resolvedOptions().timeZone) === selectedDate && <button className="secondary" onClick={() => { primeAlarmAudio(); navigate(`/workouts/${active.data!._id}`); }}>Resume saved workout</button>}
          {active.error && <p role="alert">Session recovery is unavailable: {active.error}</p>}
          {pendingRecording && <button className="secondary" onClick={async () => { try { const saved = await api.saveRecordedWorkout(pendingRecording); localStorage.removeItem(`physiquequest-draft:${accountScope()}:recorded`); notifyDataChanged('workouts', 'workout-history', 'workout-summary', 'activity', 'leaderboard'); navigate(`/workouts/${saved._id}`); } catch (err) { setActionError(String(err)); } }}>Retry saving reviewed recording</button>}
          <WorkoutHistory key={selectedDate} date={selectedDate} plan={recordingPlan}/>
        </>}
        {view === 'library' && <>
          <ExerciseLibrary selectedEquipment={profile.equipment ?? []} onBack={() => setView('plan')}/>
        </>}
        {view === 'camera' && <CameraCheck onBack={() => setView('plan')} onRecordingSaved={saved => navigate(`/workouts/${saved._id}`)} onStart={async () => { setActionError(''); try {
          if (!sessionExercises.length && !startIntent.current) throw new Error('Select a program with available exercises first.');
          primeAlarmAudio();
          if (!startIntent.current) startIntent.current = { exercises: sessionExercises.map(exercise => ({ exerciseId: exercise.exerciseId, name: exercise.name, equipment: exercise.equipment ?? '', prescription: exercise.prescription, sets: expectedSets(exercise.prescription) })), key: operationKey(), startedAt: new Date().toISOString(), context: selectedContext.current };
          localStorage.setItem(`physiquequest-draft:${accountScope()}:start`, JSON.stringify(startIntent.current));
          const intent = startIntent.current;
          const created = await createSession(intent.exercises, intent.key, intent.startedAt, intent.context);
          localStorage.removeItem(`physiquequest-draft:${accountScope()}:start`); startIntent.current = null;
          navigate(`/workouts/${created._id}`);
        } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not start workout.'); } }}/>}
      </div>
      {(view === 'plan' || view === 'library') && <BottomNav coachIcon="coach-wand" />}
      {actionError && <div className="scan-warning" role="alert">{actionError}</div>}
    </section>
  );
}

