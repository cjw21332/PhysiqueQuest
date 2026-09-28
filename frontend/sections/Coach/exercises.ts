export type Exercise = { name: string; muscle: string; equipment: string; level: string; sets: string; tag: 'AI tracked' | 'Manual' | 'Caution'; tip: string };

export const exercises: Exercise[] = [
  { name: 'Push-up', muscle: 'Chest', equipment: 'Bodyweight', level: 'Beginner', sets: '3 × 12', tag: 'AI tracked', tip: 'Keep a straight line from shoulders to heels. Lower your chest with control.' },
  { name: 'Dumbbell bench press', muscle: 'Chest', equipment: 'Dumbbells', level: 'Intermediate', sets: '4 × 10 · 22 kg', tag: 'AI tracked', tip: 'Keep your wrists stacked over your elbows and lower until your upper arms are level with the bench.' },
  { name: 'Overhead press', muscle: 'Shoulders', equipment: 'Dumbbells', level: 'Intermediate', sets: '3 × 10 · 16 kg', tag: 'AI tracked', tip: 'Brace your core and press overhead without arching your lower back.' },
  { name: 'Lateral raise', muscle: 'Shoulders', equipment: 'Dumbbells', level: 'Beginner', sets: '3 × 15 · 6 kg', tag: 'AI tracked', tip: 'Raise the weights to shoulder level with a soft bend in your elbows.' },
  { name: 'Triceps extension', muscle: 'Arms', equipment: 'Dumbbells', level: 'Intermediate', sets: '3 × 12 · 10 kg', tag: 'Manual', tip: 'Keep your upper arms steady and extend through the elbow.' },
  { name: 'Plank', muscle: 'Core', equipment: 'Bodyweight', level: 'Beginner', sets: '3 × 45 s', tag: 'AI tracked', tip: 'Keep your hips level and brace your midsection throughout the hold.' },
  { name: 'Incline press', muscle: 'Chest', equipment: 'Dumbbells', level: 'Advanced', sets: '3 × 10 · 18 kg', tag: 'AI tracked', tip: 'Keep your shoulder blades supported and lower the dumbbells slowly.' },
  { name: 'Floor press', muscle: 'Chest', equipment: 'Dumbbells', level: 'Beginner', sets: '3 × 12 · 18 kg', tag: 'AI tracked', tip: 'Pause gently when your upper arms touch the floor.' },
  { name: 'Bent-over row', muscle: 'Back', equipment: 'Dumbbells', level: 'Intermediate', sets: '3 × 12 · 18 kg', tag: 'AI tracked', tip: 'Hinge at your hips and pull your elbows toward your ribs.' },
  { name: 'Goblet squat', muscle: 'Legs', equipment: 'Dumbbells', level: 'Beginner', sets: '3 × 12 · 20 kg', tag: 'Caution', tip: 'Keep your knees tracking in line with your toes.' },
];
export const muscles = ['All', 'Chest', 'Back', 'Legs', 'Core', 'Shoulders', 'Arms'];
export const equipmentTypes = ['Any equipment', 'Dumbbells', 'Bodyweight', 'Resistance bands', 'Full gym'];
