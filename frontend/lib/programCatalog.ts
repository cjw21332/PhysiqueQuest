// Built-in program library: training splits (from the PhysiqueQuest split guide),
// evidence-based exercise picks, and programs inspired by well-known athletes.
// Exercise choices favour movements with strong hypertrophy/strength evidence:
// multi-joint lifts first, plus lengthened-position isolation work (incline curls,
// overhead triceps extensions, seated leg curls, deep calf raises).

export type ExerciseKind = 'main' | 'compound' | 'iso' | 'core';
export type CatalogExercise = { key: string; name: string; muscle: string; equipment: string; kind: ExerciseKind; reps?: string; db?: string; bw?: string };

const ex = (key: string, name: string, muscle: string, equipment: string, kind: ExerciseKind, swap: { db?: string; bw?: string; reps?: string } = {}): CatalogExercise => ({ key, name, muscle, equipment, kind, ...swap });

export const EXERCISES: Record<string, CatalogExercise> = Object.fromEntries([
  ex('bench', 'Barbell Bench Press', 'Chest', 'Barbell', 'main', { db: 'db_bench', bw: 'pushup' }),
  ex('db_bench', 'Dumbbell Bench Press', 'Chest', 'Dumbbells', 'compound', { bw: 'pushup' }),
  ex('incline_db', 'Incline Dumbbell Press', 'Upper chest', 'Dumbbells', 'compound', { bw: 'decline_pushup' }),
  ex('chest_fly', 'Cable Chest Fly', 'Chest', 'Cable', 'iso', { db: 'db_fly', bw: 'pushup' }),
  ex('db_fly', 'Dumbbell Fly', 'Chest', 'Dumbbells', 'iso', { bw: 'pushup' }),
  ex('pushup', 'Push-Up', 'Chest', 'Bodyweight', 'compound'),
  ex('decline_pushup', 'Feet-Elevated Push-Up', 'Upper chest', 'Bodyweight', 'compound'),
  ex('dip', 'Dip', 'Chest', 'Bodyweight', 'compound', { db: 'db_bench', bw: 'pushup' }),
  ex('ohp', 'Overhead Press', 'Shoulders', 'Barbell', 'main', { db: 'db_shoulder', bw: 'pike_pushup' }),
  ex('db_shoulder', 'Seated Dumbbell Shoulder Press', 'Shoulders', 'Dumbbells', 'compound', { bw: 'pike_pushup' }),
  ex('pike_pushup', 'Pike Push-Up', 'Shoulders', 'Bodyweight', 'compound'),
  ex('lateral', 'Dumbbell Lateral Raise', 'Side delts', 'Dumbbells', 'iso', { bw: 'band_lateral' }),
  ex('band_lateral', 'Band Lateral Raise', 'Side delts', 'Resistance bands', 'iso', { bw: 'prone_yt' }),
  ex('prone_yt', 'Prone Y-T Raise', 'Rear & side delts', 'Bodyweight', 'iso'),
  ex('rear_delt', 'Reverse Pec Deck', 'Rear delts', 'Machine', 'iso', { db: 'db_rear_delt', bw: 'band_pull_apart' }),
  ex('db_rear_delt', 'Rear Delt Dumbbell Fly', 'Rear delts', 'Dumbbells', 'iso', { bw: 'band_pull_apart' }),
  ex('face_pull', 'Cable Face Pull', 'Rear delts', 'Cable', 'iso', { db: 'db_rear_delt', bw: 'band_pull_apart' }),
  ex('band_pull_apart', 'Band Pull-Apart', 'Rear delts', 'Resistance bands', 'iso', { bw: 'prone_yt' }),
  ex('pullup', 'Pull-Up', 'Lats', 'Bodyweight', 'compound', { db: 'db_row', bw: 'inverted_row' }),
  ex('pulldown', 'Lat Pulldown', 'Lats', 'Cable', 'compound', { db: 'db_pullover', bw: 'pullup' }),
  ex('db_pullover', 'Dumbbell Pullover', 'Lats', 'Dumbbells', 'iso', { bw: 'pullup' }),
  ex('row_bb', 'Barbell Row', 'Upper back', 'Barbell', 'main', { db: 'db_row', bw: 'inverted_row' }),
  ex('row_cable', 'Seated Cable Row', 'Upper back', 'Cable', 'compound', { db: 'chest_row', bw: 'inverted_row' }),
  ex('chest_row', 'Chest-Supported Dumbbell Row', 'Upper back', 'Dumbbells', 'compound', { bw: 'inverted_row' }),
  ex('db_row', 'One-Arm Dumbbell Row', 'Lats', 'Dumbbells', 'compound', { bw: 'inverted_row' }),
  ex('inverted_row', 'Inverted Row', 'Upper back', 'Bodyweight', 'compound'),
  ex('incline_curl', 'Incline Dumbbell Curl', 'Biceps', 'Dumbbells', 'iso', { bw: 'band_curl' }),
  ex('bb_curl', 'EZ-Bar Curl', 'Biceps', 'Barbell', 'iso', { db: 'db_curl', bw: 'band_curl' }),
  ex('db_curl', 'Dumbbell Curl', 'Biceps', 'Dumbbells', 'iso', { bw: 'band_curl' }),
  ex('hammer', 'Hammer Curl', 'Brachialis', 'Dumbbells', 'iso', { bw: 'band_curl' }),
  ex('band_curl', 'Band Curl', 'Biceps', 'Resistance bands', 'iso', { bw: 'chin_up' }),
  ex('chin_up', 'Chin-Up', 'Biceps & lats', 'Bodyweight', 'compound'),
  ex('oh_tri', 'Overhead Cable Triceps Extension', 'Triceps', 'Cable', 'iso', { db: 'db_oh_tri', bw: 'diamond_pushup' }),
  ex('db_oh_tri', 'Overhead Dumbbell Triceps Extension', 'Triceps', 'Dumbbells', 'iso', { bw: 'diamond_pushup' }),
  ex('pushdown', 'Cable Triceps Pushdown', 'Triceps', 'Cable', 'iso', { db: 'skull', bw: 'diamond_pushup' }),
  ex('skull', 'Dumbbell Skull Crusher', 'Triceps', 'Dumbbells', 'iso', { bw: 'diamond_pushup' }),
  ex('diamond_pushup', 'Diamond Push-Up', 'Triceps', 'Bodyweight', 'compound'),
  ex('squat', 'Barbell Back Squat', 'Quads', 'Barbell', 'main', { db: 'goblet', bw: 'bw_squat' }),
  ex('goblet', 'Goblet Squat', 'Quads', 'Dumbbells', 'compound', { bw: 'bw_squat' }),
  ex('bw_squat', 'Bodyweight Squat', 'Quads', 'Bodyweight', 'compound', { reps: '15-20' }),
  ex('leg_press', 'Leg Press', 'Quads', 'Machine', 'compound', { db: 'split_squat', bw: 'bw_split_squat' }),
  ex('split_squat', 'Bulgarian Split Squat', 'Quads & glutes', 'Dumbbells', 'compound', { bw: 'bw_split_squat' }),
  ex('bw_split_squat', 'Bodyweight Bulgarian Split Squat', 'Quads & glutes', 'Bodyweight', 'compound'),
  ex('leg_ext', 'Leg Extension', 'Quads', 'Machine', 'iso', { db: 'step_up', bw: 'reverse_lunge' }),
  ex('step_up', 'Dumbbell Step-Up', 'Quads', 'Dumbbells', 'compound', { bw: 'reverse_lunge' }),
  ex('reverse_lunge', 'Reverse Lunge', 'Quads & glutes', 'Bodyweight', 'compound'),
  ex('rdl', 'Romanian Deadlift', 'Hamstrings', 'Barbell', 'main', { db: 'db_rdl', bw: 'sl_rdl' }),
  ex('db_rdl', 'Dumbbell Romanian Deadlift', 'Hamstrings', 'Dumbbells', 'compound', { bw: 'sl_rdl' }),
  ex('sl_rdl', 'Single-Leg Romanian Deadlift', 'Hamstrings', 'Bodyweight', 'compound'),
  ex('deadlift', 'Conventional Deadlift', 'Posterior chain', 'Barbell', 'main', { db: 'db_rdl', bw: 'sl_rdl' }),
  ex('leg_curl', 'Seated Leg Curl', 'Hamstrings', 'Machine', 'iso', { db: 'slider_curl', bw: 'slider_curl' }),
  ex('slider_curl', 'Sliding Leg Curl', 'Hamstrings', 'Bodyweight', 'iso'),
  ex('hip_thrust', 'Barbell Hip Thrust', 'Glutes', 'Barbell', 'compound', { db: 'db_hip_thrust', bw: 'glute_bridge' }),
  ex('db_hip_thrust', 'Dumbbell Hip Thrust', 'Glutes', 'Dumbbells', 'compound', { bw: 'glute_bridge' }),
  ex('glute_bridge', 'Single-Leg Glute Bridge', 'Glutes', 'Bodyweight', 'compound'),
  ex('calf', 'Standing Calf Raise', 'Calves', 'Machine', 'iso', { db: 'db_calf', bw: 'sl_calf' }),
  ex('db_calf', 'Dumbbell Calf Raise', 'Calves', 'Dumbbells', 'iso', { bw: 'sl_calf' }),
  ex('sl_calf', 'Single-Leg Calf Raise', 'Calves', 'Bodyweight', 'iso'),
  ex('back_ext', 'Back Extension', 'Lower back', 'Bodyweight', 'core'),
  ex('hanging_leg', 'Hanging Leg Raise', 'Abs', 'Bodyweight', 'core', { bw: 'reverse_crunch' }),
  ex('reverse_crunch', 'Reverse Crunch', 'Abs', 'Bodyweight', 'core'),
  ex('cable_crunch', 'Cable Crunch', 'Abs', 'Cable', 'core', { db: 'reverse_crunch', bw: 'reverse_crunch' }),
  ex('plank', 'Plank', 'Core', 'Bodyweight', 'core', { reps: '30-45 s' }),
].map(item => [item.key, item]));

// Session templates: ordered heavy compounds first, isolation last.
export const SESSIONS: Record<string, { title: string; items: string[] }> = {
  push: { title: 'Push', items: ['bench', 'incline_db', 'db_shoulder', 'lateral', 'oh_tri', 'pushdown'] },
  pull: { title: 'Pull', items: ['pulldown', 'row_bb', 'row_cable', 'rear_delt', 'incline_curl', 'hammer'] },
  legs: { title: 'Legs', items: ['squat', 'rdl', 'leg_press', 'leg_curl', 'leg_ext', 'calf'] },
  upper: { title: 'Upper', items: ['bench', 'row_bb', 'db_shoulder', 'pulldown', 'lateral', 'incline_curl', 'oh_tri'] },
  lower: { title: 'Lower', items: ['squat', 'rdl', 'split_squat', 'leg_curl', 'calf', 'hanging_leg'] },
  full_a: { title: 'Full Body A', items: ['squat', 'bench', 'row_cable', 'leg_curl', 'lateral', 'incline_curl'] },
  full_b: { title: 'Full Body B', items: ['rdl', 'ohp', 'pulldown', 'split_squat', 'chest_fly', 'oh_tri'] },
  full: { title: 'Full Body', items: ['squat', 'bench', 'pulldown', 'rdl', 'lateral', 'plank'] },
  chest_back: { title: 'Chest + Back', items: ['bench', 'row_bb', 'incline_db', 'pulldown', 'chest_fly', 'row_cable'] },
  shoulders_arms: { title: 'Shoulders + Arms', items: ['ohp', 'lateral', 'rear_delt', 'bb_curl', 'oh_tri', 'incline_curl', 'pushdown'] },
  chest: { title: 'Chest', items: ['bench', 'incline_db', 'dip', 'chest_fly'] },
  back: { title: 'Back', items: ['pullup', 'row_bb', 'pulldown', 'row_cable', 'face_pull'] },
  shoulders: { title: 'Shoulders', items: ['ohp', 'lateral', 'rear_delt', 'face_pull'] },
  arms: { title: 'Arms', items: ['bb_curl', 'oh_tri', 'incline_curl', 'pushdown', 'hammer'] },
  anterior: { title: 'Anterior', items: ['squat', 'bench', 'leg_ext', 'db_shoulder', 'lateral', 'cable_crunch'] },
  posterior: { title: 'Posterior', items: ['rdl', 'pulldown', 'row_cable', 'leg_curl', 'rear_delt', 'back_ext'] },
};

export type TemplateDay = { weekday: number; session: string; title?: string; items?: string[] };
export type ProgramTemplate = { id: string; kind: 'split' | 'athlete'; name: string; daysPerWeek: string; summary: string; detail: string; days: TemplateDay[]; athlete?: string; tag?: string; style?: { sets?: number; reps?: string; rest?: number } };

const d = (weekday: number, session: string, extra: Partial<TemplateDay> = {}): TemplateDay => ({ weekday, session, ...extra });

// Weekday index: 0 = Monday … 6 = Sunday.
export const SPLITS: ProgramTemplate[] = [
  { id: 'ppl-6', kind: 'split', name: 'Push / Pull / Legs', daysPerWeek: '6', summary: 'Push, pull, legs; repeated', detail: 'Training is divided into pushing muscles, pulling muscles, and legs. Push trains the chest, shoulders, and triceps; pull trains the back and biceps; legs trains the quads, hamstrings, glutes, and calves.', days: [d(0, 'push'), d(1, 'pull'), d(2, 'legs'), d(3, 'push'), d(4, 'pull'), d(5, 'legs')] },
  { id: 'arnold-6', kind: 'split', name: 'Arnold Split', daysPerWeek: '6', summary: 'Chest/back, shoulders/arms, legs; repeated', detail: 'A bodybuilding split organised around chest and back, shoulders and arms, and legs, repeated twice each week.', days: [d(0, 'chest_back'), d(1, 'shoulders_arms'), d(2, 'legs'), d(3, 'chest_back'), d(4, 'shoulders_arms'), d(5, 'legs')] },
  { id: 'bro-5', kind: 'split', name: 'Bro Split', daysPerWeek: '5', summary: 'One main body part per day', detail: 'Dedicates one training day to each major muscle group or body part.', days: [d(0, 'chest'), d(1, 'back'), d(2, 'shoulders'), d(3, 'legs'), d(4, 'arms')] },
  { id: 'ppl-ul-5', kind: 'split', name: 'PPL + Upper / Lower', daysPerWeek: '5', summary: 'Focused days plus upper/lower', detail: 'Combines a three-day Push/Pull/Legs sequence with two broader Upper- and Lower-body sessions. For UL/PPL, run the upper and lower days first.', days: [d(0, 'push'), d(1, 'pull'), d(2, 'legs'), d(4, 'upper'), d(5, 'lower')] },
  { id: 'ul-4', kind: 'split', name: 'Upper / Lower', daysPerWeek: '4', summary: 'Alternate upper and lower body', detail: 'Alternates upper-body and lower-body training. Upper days train the chest, back, shoulders, and arms; lower days train the quads, hamstrings, glutes, and calves.', days: [d(0, 'upper'), d(1, 'lower'), d(3, 'upper'), d(4, 'lower')] },
  { id: 'ant-post-4', kind: 'split', name: 'Anterior / Posterior', daysPerWeek: '4', summary: 'Front-side and back-side sessions', detail: 'Separates training into the front and back of the body. Anterior days train quads, chest, front and side delts, and abs; posterior days train hamstrings, glutes, back, rear delts, and spinal erectors.', days: [d(0, 'anterior'), d(1, 'posterior'), d(3, 'anterior'), d(4, 'posterior')] },
  { id: 'fbeod', kind: 'split', name: 'Full Body Every Other Day', daysPerWeek: '3-4', summary: 'Full body with rest between sessions', detail: 'Each workout trains the major muscle groups, with a rest day between sessions. Keep each session manageable rather than doing a lot of work for every muscle.', days: [d(0, 'full_a'), d(2, 'full_b'), d(4, 'full_a')] },
  { id: 'fb-u-l-3', kind: 'split', name: 'Full Body / Upper / Lower', daysPerWeek: '3', summary: 'One full-body, one upper, one lower', detail: 'One full-body day, one upper-body day, and one lower-body day. The full-body day uses moderate volume so it does not interfere with the dedicated upper and lower sessions.', days: [d(0, 'full'), d(3, 'upper'), d(4, 'lower')] },
  { id: 'u-l-fb-3', kind: 'split', name: 'Upper / Lower / Full Body', daysPerWeek: '3', summary: 'Upper, lower, then full body', detail: 'The reverse order of Full Body / Upper / Lower: start the week with dedicated upper and lower sessions and finish with a full-body day.', days: [d(0, 'upper'), d(1, 'lower'), d(4, 'full')] },
  { id: 'fb-ab-2', kind: 'split', name: 'Full Body A / B', daysPerWeek: '2', summary: 'Two different full-body workouts', detail: 'Both workouts train the whole body, but use different exercises and emphasise different movement patterns.', days: [d(1, 'full_a'), d(4, 'full_b')] },
  { id: 'ul-2', kind: 'split', name: 'Upper / Lower (2 days)', daysPerWeek: '2', summary: 'One upper day and one lower day', detail: 'One day is dedicated to the upper body and the other to the lower body.', days: [d(1, 'upper'), d(4, 'lower')] },
];

// Programs inspired by publicly described training styles. Exercise picks are PhysiqueQuest's own.
export const ATHLETES: ProgramTemplate[] = [
  { id: 'arnold-golden-era', kind: 'athlete', athlete: 'Arnold Schwarzenegger', tag: 'Golden Era volume', name: 'Golden Era Double Split', daysPerWeek: '6', summary: 'High-volume chest/back, shoulders/arms and legs, twice a week.', detail: 'Built around the classic chest-and-back pairing and high set counts that defined 1970s bodybuilding. Expect long sessions and lots of pump work.', style: { sets: 4, reps: '8-12' }, days: [d(0, 'chest_back', { items: ['bench', 'pullup', 'incline_db', 'row_bb', 'db_fly', 'db_pullover'] }), d(1, 'shoulders_arms'), d(2, 'legs'), d(3, 'chest_back', { items: ['bench', 'pullup', 'incline_db', 'row_bb', 'db_fly', 'db_pullover'] }), d(4, 'shoulders_arms'), d(5, 'legs')] },
  { id: 'ronnie-heavy-mass', kind: 'athlete', athlete: 'Ronnie Coleman', tag: 'Heavy mass', name: 'Heavy Mass Builder', daysPerWeek: '6', summary: 'Heavy compound lifts first, then volume, six days a week.', detail: 'A mass-building rotation that leans on heavy squats, deadlifts, rows and presses before finishing with machine and isolation work.', style: { reps: '8-12' }, days: [d(0, 'back', { title: 'Back + Biceps', items: ['deadlift', 'row_bb', 'pulldown', 'row_cable', 'bb_curl', 'hammer'] }), d(1, 'chest', { title: 'Chest + Triceps', items: ['bench', 'incline_db', 'chest_fly', 'dip', 'skull'] }), d(2, 'legs', { title: 'Legs', items: ['squat', 'leg_press', 'rdl', 'leg_curl', 'calf'] }), d(3, 'back', { title: 'Back + Biceps', items: ['row_bb', 'pullup', 'db_row', 'face_pull', 'incline_curl'] }), d(4, 'shoulders', { title: 'Shoulders + Triceps', items: ['ohp', 'db_shoulder', 'lateral', 'rear_delt', 'pushdown'] }), d(5, 'legs', { title: 'Legs', items: ['squat', 'hip_thrust', 'split_squat', 'leg_ext', 'leg_curl', 'calf'] })] },
  { id: 'dorian-hit', kind: 'athlete', athlete: 'Dorian Yates', tag: 'High intensity', name: 'Blood & Guts HIT', daysPerWeek: '4', summary: 'Few all-out working sets after thorough warm-ups.', detail: 'Low volume, very high effort: after warm-up sets, take each working set close to failure with strict form. Long rests keep every set heavy.', style: { sets: 2, reps: '6-10', rest: 180 }, days: [d(0, 'chest', { title: 'Chest + Biceps', items: ['incline_db', 'bench', 'chest_fly', 'bb_curl', 'incline_curl'] }), d(1, 'legs', { title: 'Legs', items: ['leg_ext', 'leg_press', 'squat', 'leg_curl', 'rdl', 'calf'] }), d(3, 'shoulders', { title: 'Shoulders + Triceps', items: ['db_shoulder', 'lateral', 'rear_delt', 'pushdown', 'oh_tri'] }), d(4, 'back', { title: 'Back', items: ['pulldown', 'db_row', 'row_bb', 'face_pull', 'deadlift'] })] },
  { id: 'mentzer-heavy-duty', kind: 'athlete', athlete: 'Mike Mentzer', tag: 'Heavy Duty', name: 'Heavy Duty Minimalist', daysPerWeek: '3', summary: 'One set to failure per exercise, lots of recovery.', detail: 'A minimalist high-intensity approach: one hard working set per exercise after warm-ups, with plenty of rest days. Add days off between sessions if you are still sore.', style: { sets: 1, reps: '6-10', rest: 180 }, days: [d(0, 'chest_back', { title: 'Chest + Back', items: ['db_fly', 'incline_db', 'pulldown', 'row_cable', 'dip'] }), d(2, 'legs', { title: 'Legs', items: ['leg_ext', 'leg_press', 'leg_curl', 'calf'] }), d(4, 'shoulders_arms', { title: 'Shoulders + Arms', items: ['lateral', 'rear_delt', 'bb_curl', 'pushdown', 'diamond_pushup'] })] },
  { id: 'reeves-classic', kind: 'athlete', athlete: 'Steve Reeves', tag: 'Classic full body', name: 'Classic Full Body', daysPerWeek: '3', summary: 'Three balanced full-body sessions a week.', detail: 'A pre-steroid-era classic: train the whole body three times a week with a few hard sets per exercise and full rest days between sessions.', style: { sets: 3, reps: '8-12' }, days: [d(0, 'full', { items: ['ohp', 'bench', 'pullup', 'squat', 'rdl', 'bb_curl', 'oh_tri', 'calf'] }), d(2, 'full', { items: ['incline_db', 'row_bb', 'db_shoulder', 'split_squat', 'leg_curl', 'incline_curl', 'pushdown', 'calf'] }), d(4, 'full', { items: ['ohp', 'bench', 'pullup', 'squat', 'rdl', 'bb_curl', 'oh_tri', 'calf'] })] },
  { id: 'zane-symmetry', kind: 'athlete', athlete: 'Frank Zane', tag: 'Symmetry', name: 'Symmetry Rotation', daysPerWeek: '6', summary: 'Three-day rotation run twice, focused on proportion.', detail: 'Moderate weights, strict form and a focus on balanced proportions, run as a three-day rotation twice per week.', style: { reps: '8-12' }, days: [d(0, 'pull', { title: 'Back + Biceps', items: ['pulldown', 'row_cable', 'db_row', 'db_pullover', 'incline_curl', 'hammer'] }), d(1, 'legs', { title: 'Legs + Abs', items: ['squat', 'leg_ext', 'leg_curl', 'calf', 'hanging_leg'] }), d(2, 'push', { title: 'Chest + Shoulders + Triceps', items: ['incline_db', 'bench', 'db_fly', 'lateral', 'rear_delt', 'oh_tri'] }), d(3, 'pull', { title: 'Back + Biceps', items: ['pulldown', 'row_cable', 'db_row', 'db_pullover', 'incline_curl', 'hammer'] }), d(4, 'legs', { title: 'Legs + Abs', items: ['squat', 'leg_ext', 'leg_curl', 'calf', 'hanging_leg'] }), d(5, 'push', { title: 'Chest + Shoulders + Triceps', items: ['incline_db', 'bench', 'db_fly', 'lateral', 'rear_delt', 'oh_tri'] })] },
  { id: 'cbum-classic', kind: 'athlete', athlete: 'Chris Bumstead', tag: 'Classic Physique', name: 'Classic Physique Split', daysPerWeek: '5', summary: 'Push, pull, legs, then upper and lower with controlled reps.', detail: 'A modern classic-physique week: controlled tempo, full range of motion and moderate rep ranges, with an emphasis on a wide back and small waist.', style: { sets: 3, reps: '8-12' }, days: [d(0, 'push'), d(1, 'pull', { items: ['pullup', 'row_cable', 'pulldown', 'rear_delt', 'incline_curl', 'hammer'] }), d(2, 'legs', { items: ['squat', 'leg_press', 'rdl', 'leg_curl', 'leg_ext', 'calf'] }), d(4, 'upper'), d(5, 'lower')] },
  { id: 'sulek-volume', kind: 'athlete', athlete: 'Sam Sulek', tag: 'High-volume bro split', name: 'High-Volume Bro Split', daysPerWeek: '5', summary: 'One body part per day with plenty of sets and pumps.', detail: 'A high-volume, body-part-per-day week with lots of machine and isolation work. Scale back sets if recovery slips.', style: { sets: 4, reps: '10-15' }, days: [d(0, 'chest', { items: ['bench', 'incline_db', 'chest_fly', 'dip', 'db_fly'] }), d(1, 'back', { items: ['pulldown', 'row_cable', 'row_bb', 'db_pullover', 'face_pull'] }), d(2, 'shoulders', { items: ['db_shoulder', 'lateral', 'rear_delt', 'face_pull', 'band_lateral'] }), d(3, 'arms', { items: ['bb_curl', 'pushdown', 'incline_curl', 'oh_tri', 'hammer', 'skull'] }), d(4, 'legs', { items: ['leg_ext', 'squat', 'leg_press', 'leg_curl', 'calf'] })] },
];

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function templateDays(template: ProgramTemplate) {
  return template.days.map(day => ({ weekday: day.weekday, title: day.title ?? SESSIONS[day.session].title, items: day.items ?? SESSIONS[day.session].items }));
}

/** Swaps gym-only exercises for dumbbell or bodyweight versions when the profile lacks a full gym. */
export function adaptToEquipment(key: string, equipment: string[] = []) {
  const item = EXERCISES[key];
  const owned = equipment.map(value => value.toLowerCase());
  if (!owned.length || owned.some(value => value.includes('full gym'))) return item;
  const hasDumbbells = owned.some(value => value.includes('dumbbell'));
  const hasBands = owned.some(value => value.includes('band'));
  const fits = (candidate: CatalogExercise) => candidate.equipment === 'Bodyweight' || (hasDumbbells && candidate.equipment === 'Dumbbells') || (hasBands && candidate.equipment === 'Resistance bands');
  let current = item;
  for (let step = 0; step < 3 && !fits(current); step++) {
    const next = (hasDumbbells && current.db) || current.bw;
    if (!next) break;
    current = EXERCISES[next];
  }
  return current;
}
