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

type View = 'plan' | 'library' | 'camera' | 'session' | 'report';

export default function CoachSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const [view, setView] = useState<View>('plan');
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState('');
  const say = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2500); };
  const goHome = () => navigate('/home');

  return (
    <section className={`coach-section coach-view-${view}`}>
      <div className="coach-scroll">
        {view === 'plan' && <CoachPlan profile={profile} onStart={() => setView('camera')} onLibrary={() => setView('library')}/>}
        {view === 'library' && <ExerciseLibrary selectedEquipment={profile.equipment ?? []} onBack={() => setView('plan')}/>}
        {view === 'camera' && <CameraCheck onBack={() => setView('plan')} onStart={() => setView('session')}/>}
        {view === 'session' && <LiveSession exercise={exercises[1]} onEnd={seconds => { setElapsed(seconds); setView('report'); }}/>}
        {view === 'report' && <WorkoutReport duration={elapsed} onHome={goHome} onShare={() => say('Workout summary is ready to share when sharing is connected.')}/>}
      </div>
      {view === 'plan' && <BottomNav />}
      {toast && <div className="home-toast coach-toast" role="status">{toast}</div>}
    </section>
  );
}
