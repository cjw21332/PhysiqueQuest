import { commonMovementScore, matchesFocus, movementFamily, primaryCategory, suitableStrengthMovement } from './movement-curation.js';

const WEEKDAYS = [
  { label: 'Mon', name: 'Monday', index: 0 },
  { label: 'Tue', name: 'Tuesday', index: 1 },
  { label: 'Wed', name: 'Wednesday', index: 2 },
  { label: 'Thu', name: 'Thursday', index: 3 },
  { label: 'Fri', name: 'Friday', index: 4 },
  { label: 'Sat', name: 'Saturday', index: 5 },
  { label: 'Sun', name: 'Sunday', index: 6 },
];

// Preferred training slots, in order, so a plan of N sessions spreads out
// instead of clustering at the start of the week.
const SLOT_ORDER = [0, 2, 4, 5, 1, 3, 6];
const WEEKDAY_INDEX: Record<string, number> = Object.fromEntries(
  WEEKDAYS.map(day => [day.name.toLowerCase(), day.index]),
);
const LEGACY_WEEKDAY_INDEX: Record<string, number> = {
  'm-0': 0,
  't-1': 1,
  'w-2': 2,
  't-3': 3,
  'f-4': 4,
  's-5': 5,
  's-6': 6,
};
const LEGACY_INITIALS: Record<string, number[]> = {
  m: [0],
  t: [1, 3],
  w: [2],
  f: [4],
  s: [5, 6],
};

function scheduledWeekdays(days: string[] | undefined): Set<number> {
  const selected = new Set<number>();
  const totals = new Map<string, number>();
  const occurrences = new Map<string, number>();
  for (const value of days ?? []) {
    const key = value.trim().toLowerCase();
    if (LEGACY_INITIALS[key]) totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  for (const value of days ?? []) {
    const key = value.trim().toLowerCase();
    const index = WEEKDAY_INDEX[key] ?? LEGACY_WEEKDAY_INDEX[key];
    if (index !== undefined) {
      selected.add(index);
      continue;
    }
    const matches = LEGACY_INITIALS[key];
    if (!matches) continue;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    selected.add(matches[Math.min(occurrence, (totals.get(key) ?? 1) - 1)]);
  }

  if (selected.size > 0) return selected;
  const sessionCount = Math.min(days?.length || 3, 7);
  return new Set(SLOT_ORDER.slice(0, sessionCount));
}

type Focus = [title: string, keywords: string[]];

const FOCUS_BY_GOAL: Record<string, Focus[]> = {
  'Build muscle': [['Upper Body — Push', ['chest', 'shoulder', 'triceps']], ['Lower Body', ['leg', 'glute', 'quad', 'hamstring']], ['Upper Body — Pull', ['back', 'biceps', 'lat']], ['Full Body', ['*']]],
  Strength: [['Lower Body Strength', ['leg', 'squat', 'deadlift', 'glute']], ['Upper Body Strength', ['chest', 'back', 'press', 'row']], ['Full Body Strength', ['*']], ['Core & Carry', ['core', 'ab']]],
  'Weight loss': [['Conditioning Circuit', ['*']], ['Lower Body Burn', ['leg', 'glute']], ['Upper Body Circuit', ['chest', 'back', 'shoulder']], ['Core & Cardio', ['core', 'cardio']]],
  Endurance: [['Interval Cardio', ['cardio', 'endurance']], ['Full Body Circuit', ['*']], ['Core & Stability', ['core', 'ab']], ['Endurance Mix', ['cardio', 'full body', 'endurance']]],
  'General fitness': [['Full Body', ['*']], ['Upper Body', ['chest', 'back', 'shoulder']], ['Lower Body', ['leg', 'glute']], ['Core & Mobility', ['core', 'ab']]],
};

const SETS_BY_GOAL: Record<string, string> = {
  'Build muscle': '3 × 10',
  Strength: '4 × 6',
  'Weight loss': '3 × 15',
  Endurance: '3 × 20',
  'General fitness': '3 × 12',
};

const EXERCISES_BY_DURATION: Record<string, number> = { '20 min': 3, '30 min': 4, '45 min': 6, '60 min': 8 };

const EXCLUSIONS: Record<string, string[]> = {
  'Knee injury': ['squat', 'lunge', 'leg press', 'jump'],
  'Lower back pain': ['deadlift', 'good morning', 'bent-over', 'back extension'],
  'Shoulder impingement': ['overhead', 'shoulder press', 'upright row', 'lateral raise'],
  Hypertension: ['hiit', 'max effort', 'sprint'],
  Asthma: ['hiit', 'sprint', 'max effort'],
};

export interface LibraryExercise {
  id: string;
  name: string;
  group: string;
  targetMuscle: string;
  equipment: string;
  pose: string;
  instructions: string[];
  gifUrl?: string;
}

export interface PlanProfile { goal: string; days?: string[]; duration?: string; equipment?: string[]; conditions?: string[]; createdAt?: string | Date; }

export class CoachPlanner {
  build(profile: PlanProfile, library: LibraryExercise[]) {
    const equipment = profile.equipment ?? [];
    const duration = profile.duration ?? '45 min';
    const available = this.filterByEquipment(library, equipment);
    const scheduled = scheduledWeekdays(profile.days);
    const sessionCount = scheduled.size;
    const focusRotation = FOCUS_BY_GOAL[profile.goal] ?? FOCUS_BY_GOAL['General fitness'];
    const perWorkout = EXERCISES_BY_DURATION[duration] ?? 5;
    let workoutIndex = 0;

    const days = WEEKDAYS.map(weekday => {
      if (!scheduled.has(weekday.index)) {
        return { ...weekday, isWorkoutDay: false, title: weekday.index === 6 ? 'Rest day' : 'Recovery day', focus: null, exercises: [] };
      }
      const [title, keywords] = focusRotation[workoutIndex % focusRotation.length];
      const picked = this.pickExercises(available, keywords, profile.conditions ?? [], perWorkout, profile.goal);
      workoutIndex += 1;
      const tip = picked.find(exercise => /press|squat|row|deadlift/i.test(exercise.name) && exercise.formTip) ?? picked.find(exercise => exercise.formTip);
      return { ...weekday, isWorkoutDay: true, title, focus: title, exercises: picked,
        equipmentLabel: [...new Set(picked.map(exercise => exercise.equipment))].join(' + '),
        formTip: tip ? { exerciseName: tip.name, text: tip.formTip } : null,
        availabilityNote: picked.length < perWorkout ? `Only ${picked.length} matching exercises are available for this program with your equipment and health preferences.` : null,
      };
    });

    const joinedAt = profile.createdAt ? new Date(profile.createdAt).getTime() : NaN;
    const week = Number.isFinite(joinedAt) ? `Week ${Math.max(1, Math.floor((Date.now() - joinedAt) / (7 * 86400000)) + 1)} · ` : '';
    return {
      goal: profile.goal,
      weekLabel: `${week}${sessionCount} sessions planned`,
      sessionCount,
      duration,
      libraryReady: available.length > 0,
      sets: SETS_BY_GOAL[profile.goal] ?? SETS_BY_GOAL['General fitness'],
      days,
    };
  }

  /** Keeps exercises whose equipment matches the profile, requiring no match when the library is silent. */
  private filterByEquipment(library: LibraryExercise[], equipment: string[]): LibraryExercise[] {
    if (equipment.includes('Full gym') || equipment.length === 0) return library;
    const wanted = equipment.map(value => value.toLowerCase());
    return library.filter(exercise => {
      const available = exercise.equipment.trim().toLowerCase();
      if (!available) return false;
      const normalize = (value: string) => value.replace(' only', '').replace(/s$/, '').trim();
      return wanted.some(value => normalize(value) === normalize(available)) || available.includes('bodyweight');
    });
  }

  private pickExercises(library: LibraryExercise[], keywords: string[], conditions: string[], count: number, goal: string) {
    const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const excluded = conditions.flatMap(condition => EXCLUSIONS[condition] ?? []).map(normalized);
    const safe = library.filter(exercise => {
      const haystack = normalized(`${exercise.name} ${exercise.group} ${exercise.targetMuscle}`);
      const category = primaryCategory(exercise.targetMuscle, exercise.group);
      const eligible = category === 'Cardio' ? goal === 'Endurance' : suitableStrengthMovement(exercise.name);
      return !excluded.some(term => haystack.includes(term)) && eligible && matchesFocus(category, exercise.name, keywords);
    });
    const priority = (exercise: LibraryExercise) => ['bodyweight push', 'horizontal push', 'vertical push', 'squat', 'hinge', 'row', 'vertical pull'].includes(movementFamily(exercise.name)) ? 0 : primaryCategory(exercise.targetMuscle, exercise.group) === 'Core' ? 2 : 1;
    const scored = safe
      .map(exercise => ({ exercise, score: commonMovementScore(exercise.name) }))
      .sort((a, b) => priority(a.exercise) - priority(b.exercise) || b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
      .map(entry => entry.exercise);
    // Prefer distinct movement families before adding a second variant.
    const coreFocus = keywords.includes('core') || keywords.includes('ab');
    const family = (exercise: LibraryExercise) => primaryCategory(exercise.targetMuscle, exercise.group) === 'Core' && !coreFocus ? 'core' : movementFamily(exercise.name);
    const picked: LibraryExercise[] = [];
    const families = new Set<string>();
    for (const exercise of scored) {
      if (picked.length >= count) break;
      if (!families.has(family(exercise))) { picked.push(exercise); families.add(family(exercise)); }
    }
    return picked.map(exercise => ({
      exerciseId: exercise.id,
      slug: exercise.id,
      gifUrl: exercise.gifUrl,
      instructions: exercise.instructions,
      name: exercise.name,
      group: exercise.group,
      targetMuscle: exercise.targetMuscle,
      equipment: exercise.equipment,
      tracking: 'Manual',
      prescription: primaryCategory(exercise.targetMuscle, exercise.group) === 'Cardio' || /plank|wall sit|hold/i.test(exercise.name) ? '3 × 45 s' : goal === 'Build muscle' ? (/bench|incline|floor press|squat|row|deadlift/i.test(exercise.name) ? '4 × 10' : /lateral raise/i.test(exercise.name) ? '3 × 15' : /overhead|shoulder press/i.test(exercise.name) ? '3 × 10' : '3 × 12') : SETS_BY_GOAL[goal] ?? SETS_BY_GOAL['General fitness'],
      formTip: exercise.instructions.find(step => step.trim()) ?? null,
    }));
  }
}
