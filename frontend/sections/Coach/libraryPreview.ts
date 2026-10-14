// Explicit local sample catalog; never a substitute for a failed API response.
export type LibraryExercise = {
  name: string; muscle: string; equipment: string; level: string; recommended: string;
  tag: 'AI tracked' | 'Manual' | 'Caution'; instructions: string[]; checks: string[]; poster?: string;
};
export const libraryPreview: LibraryExercise[] = [
  {
    name: 'Dumbbell bench press', muscle: 'Chest', equipment: 'Dumbbells', level: 'Intermediate', recommended: '4 × 10', tag: 'AI tracked', poster: '/exercise-library-reference.png',
    instructions: ['Lie flat with feet planted and a dumbbell in each hand at chest height.', 'Press both dumbbells up until your arms are straight over your shoulders.', 'Lower slowly until your elbows sit just below the bench line.', 'Pause for a beat, then press back up without bouncing.'],
    checks: ['Wrists stacked over elbows', 'Elbows at roughly 45° from your torso', 'Shoulder blades pinned to the bench'],
  },
  {
    name: 'Overhead press', muscle: 'Shoulders', equipment: 'Dumbbells', level: 'Intermediate', recommended: '3 × 10', tag: 'AI tracked',
    instructions: ['Stand with feet hip-width apart and hold the dumbbells at shoulder height.', 'Brace your core and press the weights overhead.', 'Keep your ribs down and avoid arching your lower back.', 'Lower slowly to shoulder height before the next repetition.'],
    checks: ['Wrists stacked over elbows', 'Ribs down and core braced', 'Weights finish above the shoulders'],
  },
  {
    name: 'Incline press', muscle: 'Chest', equipment: 'Dumbbells', level: 'Advanced', recommended: '3 × 10', tag: 'AI tracked',
    instructions: ['Set the bench to a slight incline and plant your feet.', 'Hold the dumbbells beside your upper chest.', 'Press up with your shoulder blades supported by the bench.', 'Lower the weights slowly without bouncing.'],
    checks: ['Shoulder blades supported', 'Wrists aligned with forearms', 'Controlled lowering phase'],
  },
  {
    name: 'Floor press', muscle: 'Chest', equipment: 'Dumbbells', level: 'Beginner', recommended: '3 × 12', tag: 'AI tracked',
    instructions: ['Lie on the floor with knees bent and feet planted.', 'Hold the dumbbells above your chest.', 'Lower until your upper arms gently touch the floor.', 'Pause, then press the weights up without bouncing.'],
    checks: ['Wrists stacked over elbows', 'Upper arms touch down gently', 'Shoulders stay supported'],
  },
  {
    name: 'Bent-over row', muscle: 'Back', equipment: 'Dumbbells', level: 'Intermediate', recommended: '3 × 12', tag: 'AI tracked',
    instructions: ['Stand with feet hip-width apart and a dumbbell in each hand.', 'Hinge at your hips with a soft bend in your knees.', 'Pull your elbows toward your ribs without swinging.', 'Lower the weights with control while keeping your back steady.'],
    checks: ['Neutral back position', 'Elbows travel toward the ribs', 'Torso stays steady'],
  },
  {
    name: 'Goblet squat', muscle: 'Legs', equipment: 'Dumbbells', level: 'Beginner', recommended: '3 × 12', tag: 'Caution',
    instructions: ['Hold one dumbbell close to your chest with both hands.', 'Stand with feet about shoulder-width apart.', 'Sit down between your hips, keeping your heels planted.', 'Push through your feet to stand; stop if you feel pain.'],
    checks: ['Knees track in line with toes', 'Heels stay planted', 'Chest stays lifted'],
  },
];
export const libraryMuscles = ['All', 'Chest', 'Back', 'Legs', 'Core', 'Shoulders', 'Arms'];
export const libraryEquipment = ['Any equipment', 'Dumbbells', 'Bodyweight', 'Resistance bands', 'Full gym'];
export function filterLibrary(items: LibraryExercise[], search: string, muscle: string, equipment: string) {
  const query = search.trim().toLowerCase();
  return items.filter(item => (!query || item.name.toLowerCase().includes(query)) && (muscle === 'All' || item.muscle === muscle) && (equipment === 'Any equipment' || item.equipment === equipment));
}
