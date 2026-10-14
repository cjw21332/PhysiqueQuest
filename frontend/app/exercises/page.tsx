'use client';

import ExerciseLibrary from '../../sections/Coach/ExerciseLibrary';
import BottomNav from '../../sections/Home/BottomNav';

export default function ExerciseLibraryPage() {
  return <main className="scene"><div className="app-shell"><section className="coach-section coach-view-library"><div className="coach-scroll"><ExerciseLibrary onBack={() => { window.location.href = '/coach'; }}/></div><BottomNav coachIcon="coach-wand"/></section></div></main>;
}
