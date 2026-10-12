import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Profile } from '../profile/schemas/profile.schema.js';
import { Settings } from '../settings/schemas/settings.schema.js';
import { ExerciseRecord } from '../exercises/schemas/exercise.schema.js';

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
  'Build muscle': [['Upper Body', ['chest', 'shoulder', 'triceps']], ['Lower Body', ['leg', 'glute', 'quad', 'hamstring']], ['Upper Body', ['back', 'biceps', 'lat']], ['Full Body', ['full body', 'core']]],
  Strength: [['Lower Body Strength', ['leg', 'squat', 'deadlift', 'glute']], ['Upper Body Strength', ['chest', 'back', 'press', 'row']], ['Full Body Strength', ['full body', 'core']], ['Core & Carry', ['core', 'ab']]],
  'Weight loss': [['Conditioning Circuit', ['full body', 'cardio', 'conditioning']], ['Lower Body Burn', ['leg', 'glute']], ['Upper Body Circuit', ['chest', 'back', 'shoulder']], ['Core & Cardio', ['core', 'cardio']]],
  Endurance: [['Interval Cardio', ['cardio', 'endurance']], ['Full Body Circuit', ['full body']], ['Core & Stability', ['core', 'ab']], ['Endurance Mix', ['cardio', 'full body', 'endurance']]],
  'General fitness': [['Full Body', ['full body']], ['Upper Body', ['chest', 'back', 'shoulder']], ['Lower Body', ['leg', 'glute']], ['Core & Mobility', ['core', 'ab']]],
};

const SETS_BY_GOAL: Record<string, string> = {
  'Build muscle': '3 × 10',
  Strength: '4 × 6',
  'Weight loss': '3 × 15',
  Endurance: '3 × 20',
  'General fitness': '3 × 12',
};

const EXERCISES_BY_DURATION: Record<string, number> = { '20 min': 3, '30 min': 4, '45 min': 5, '60 min': 6 };

const EXCLUSIONS: Record<string, string[]> = {
  'Knee injury': ['squat', 'lunge', 'leg press', 'jump'],
  'Lower back pain': ['deadlift', 'good morning', 'bent-over', 'back extension'],
  'Shoulder impingement': ['overhead', 'shoulder press', 'upright row', 'lateral raise'],
  Hypertension: ['hiit', 'max effort', 'sprint'],
  Asthma: ['hiit', 'sprint', 'max effort'],
};

interface LibraryExercise {
  id: string;
  name: string;
  group: string;
  targetMuscle: string;
  equipment: string;
  pose: string;
}

@Injectable()
export class CoachService {
  constructor(
    @InjectModel(Profile.name) private readonly profiles: Model<Profile>,
    @InjectModel(Settings.name) private readonly settings: Model<Settings>,
    @InjectModel(ExerciseRecord.name) private readonly exercises: Model<ExerciseRecord>,
  ) {}

  async getPlan(userId: string) {
    const profile = await this.profileModel(userId);
    const settings = await this.settings.findOne({ userId: new Types.ObjectId(userId) }).lean().exec();
    const values = (settings as { values?: Record<string, unknown> } | null)?.values ?? {};
    const equipment = (Array.isArray(values.equipment) ? values.equipment : undefined) ?? profile.equipment ?? [];
    const duration = (typeof values.duration === 'string' ? values.duration : undefined) ?? profile.duration ?? '45 min';

    const records = await this.exercises.find({ status: 'published' }).select('name group targetMuscle equipment pose').lean().exec();
    const library: LibraryExercise[] = (records as { _id: unknown; name: string; group?: string; targetMuscle?: string; equipment?: string; pose?: string }[]).map(record => ({
      id: String(record._id),
      name: record.name,
      group: record.group ?? 'General',
      targetMuscle: record.targetMuscle ?? '',
      equipment: record.equipment ?? '',
      pose: record.pose ?? 'missing',
    }));

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
      const picked = this.pickExercises(available, keywords, profile.conditions ?? [], perWorkout, workoutIndex);
      workoutIndex += 1;
      return { ...weekday, isWorkoutDay: true, title, focus: title, exercises: picked };
    });

    return {
      goal: profile.goal,
      weekLabel: `${sessionCount} sessions planned`,
      sessionCount,
      duration,
      libraryReady: available.length > 0,
      sets: SETS_BY_GOAL[profile.goal] ?? SETS_BY_GOAL['General fitness'],
      days,
    };
  }

  private async profileModel(userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new NotFoundException('Profile not found');
    const profile = await this.profiles.findOne({ userId: new Types.ObjectId(userId) }).lean().exec();
    if (!profile) throw new NotFoundException('Profile not found');
    return profile as unknown as Profile;
  }

  /** Keeps exercises whose equipment matches the profile, requiring no match when the library is silent. */
  private filterByEquipment(library: LibraryExercise[], equipment: string[]): LibraryExercise[] {
    if (equipment.includes('Full gym') || equipment.length === 0) return library;
    const wanted = equipment.map(value => value.toLowerCase());
    return library.filter(exercise => {
      const available = exercise.equipment.trim().toLowerCase();
      if (!available) return true;
      return wanted.some(value => value.replace(' only', '').split(' ').some(word => word.length > 3 && available.includes(word))) || available.includes('bodyweight');
    });
  }

  private pickExercises(library: LibraryExercise[], keywords: string[], conditions: string[], count: number, offset: number) {
    const excluded = conditions.flatMap(condition => EXCLUSIONS[condition] ?? []);
    const safe = library.filter(exercise => {
      const haystack = `${exercise.name} ${exercise.group} ${exercise.targetMuscle}`.toLowerCase();
      return !excluded.some(term => haystack.includes(term));
    });
    const scored = safe
      .map(exercise => ({ exercise, score: keywords.reduce((total, keyword) => total + (`${exercise.group} ${exercise.targetMuscle} ${exercise.name}`.toLowerCase().includes(keyword) ? 1 : 0), 0) }))
      .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
      .map(entry => entry.exercise);
    const pool = scored.length ? scored : safe;
    if (!pool.length) return [];
    const start = (offset * count) % pool.length;
    const picked: LibraryExercise[] = [];
    for (let i = 0; i < Math.min(count, pool.length); i += 1) picked.push(pool[(start + i) % pool.length]);
    return picked.map(exercise => ({
      exerciseId: exercise.id,
      name: exercise.name,
      group: exercise.group,
      targetMuscle: exercise.targetMuscle,
      equipment: exercise.equipment,
      tracking: exercise.pose === 'ready' ? 'AI tracked' : 'Manual',
    }));
  }
}
