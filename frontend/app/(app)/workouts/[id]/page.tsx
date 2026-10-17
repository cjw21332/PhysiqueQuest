'use client';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, type WorkoutSessionRecord } from '../../../../lib/api';
import { useSettings } from '../../../../hooks/useSettings';
import { useCurrentProfile } from '../../../../hooks/useCurrentProfile';
import WorkoutRunner from '../../../../sections/Coach/WorkoutRunner';
import WorkoutReport from '../../../../sections/Coach/WorkoutReport';
import BottomNav from '../../../../sections/Home/BottomNav';
import { navigate } from '../../../../lib/navigation';
import '../../../../sections/Coach/coach-reference.css';

export default function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const [workout, setWorkout] = useState<WorkoutSessionRecord | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [workout?.status]);
  const {
    settings,
    loading: settingsLoading,
    error: settingsError,
  } = useSettings();
  const {
    profile,
    error: profileError,
    retry: retryProfile,
  } = useCurrentProfile();
  useEffect(() => {
    let active = true;
    setError('');
    setWorkout(null);
    api
      .getWorkout(id)
      .then((result) => {
        if (active) setWorkout(result);
      })
      .catch((err) => {
        if (active) setError(String(err));
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  return (
    <main className="scene">
      <div className="app-shell">
        <section
          className={`coach-section coach-view-${workout?.status === 'completed' ? 'report' : 'session'}`}
        >
          <div ref={scrollRef} className="coach-scroll">
            {error ? (
              <p role="alert">
                {error}
                <button onClick={() => setAttempt((value) => value + 1)}>
                  Retry
                </button>
              </p>
            ) : !workout ? (
              <p role="status">Loading saved workout…</p>
            ) : workout.status === 'completed' ? (
              <WorkoutReport
                workout={workout}
                onBack={() => navigate('/coach')}
                onHome={() => navigate('/home')}
                onShare={async () => {
                  const text = `${workout.exercises?.map((exercise) => exercise.name).join(', ') || 'Workout'}: ${workout.sets?.filter((set) => set.status === 'completed').length ?? 0} sets completed.`;
                  if (navigator.share)
                    await navigator
                      .share({ title: 'PhysiqueQuest workout', text })
                      .catch(() => {});
                  else if (navigator.clipboard) {
                    try {
                      await navigator.clipboard.writeText(text);
                      setNotice('Workout summary copied.');
                    } catch {
                      setNotice('Sharing is unavailable on this device.');
                    }
                  } else setNotice('Sharing is unavailable on this device.');
                }}
              />
            ) : profileError ? (
              <p role="alert">
                {profileError}
                <button onClick={() => void retryProfile()}>
                  Retry profile
                </button>
              </p>
            ) : settingsLoading || !profile ? (
              <p role="status">Loading workout settings…</p>
            ) : settingsError ? (
              <p role="alert">{settingsError}</p>
            ) : (
              <WorkoutRunner
                workout={workout}
                settings={settings}
                contactName={profile.contactName ?? ''}
                contactPhone={profile.contactPhone ?? ''}
                onCompleted={setWorkout}
              />
            )}
            {notice && <p role="status">{notice}</p>}
          </div>
          <BottomNav coachIcon="coach-wand" />
        </section>
      </div>
    </main>
  );
}

