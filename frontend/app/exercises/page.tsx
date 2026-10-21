'use client';

import { useRouter } from 'next/navigation';
import ExerciseLibrary from '../../sections/Coach/ExerciseLibrary';
import BottomNav from '../../sections/Home/BottomNav';

export default function ExerciseLibraryPage() {
  const router = useRouter();
  return <main className="scene coach-dark-theme"><div className="app-shell"><section className="coach-section coach-view-library"><div className="coach-scroll"><ExerciseLibrary onBack={() => { router.push('/coach'); }}/></div><BottomNav coachIcon="coach-wand"/></section></div></main>;
}
