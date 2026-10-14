'use client';

import ExerciseLibrary from '../../sections/Coach/ExerciseLibrary';
import { navigate } from '../../lib/navigation';

export default function ExerciseLibraryPage() {
  return <main className="coach-section"><ExerciseLibrary selectedEquipment={[]} onBack={() => navigate('/coach')}/></main>;
}
