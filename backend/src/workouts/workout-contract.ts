export type WorkoutExercise = {
  exerciseId: string;
  name: string;
  equipment: string;
  prescription?: string;
  sets: number;
  trackingPresetId?: string;
};
export type SetResult = {
  setId: string;
  exerciseId: string;
  setIndex: number;
  reps: number;
  durationSeconds?: number;
  loadKg?: number;
  status: 'completed' | 'skipped';
  source: 'manual' | 'local-video';
  detectedReps?: number;
  side?: 'left' | 'right';
  algorithmVersion?: string;
  clipDurationSeconds?: number;
  trackingPresetId?: string;
  sourceRecordingId?: string;
};
export type WorkoutRecord = {
  _id: string;
  exerciseIds: string[];
  exercises?: WorkoutExercise[];
  exerciseResults?: { exerciseId: string; reps: number; loadKg?: number }[];
  sets?: SetResult[];
  revision?: number;
  origin?: 'planned' | 'standalone' | 'recorded-set';
  programVersion?: string;
  dayIndex?: number;
  scheduledDate?: string;
  startedAt: string;
  endedAt?: string;
  pausedAt?: string;
  pausedSeconds?: number;
  durationSeconds?: number;
  status: 'active' | 'completed';
  timezone?: string;
  activityDate?: string;
  creditPolicyVersion?: number;
  appliedRecordingIds?: string[];
};
export const WORKOUT_CREDIT_POINTS = 100;
export const workoutCreditFilter = {
  origin: { $ne: 'recorded-set' },
  $or: [
    { sets: { $exists: false } },
    { sets: { $size: 0 } },
    { sets: { $elemMatch: { status: 'completed' } } },
  ],
};
export function activityDate(value: string | Date, timezone = 'UTC') {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  let zone = timezone;
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
  } catch {
    zone = 'UTC';
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)?.value ?? '')
    .join('-');
}
export function earnsWorkoutCredit(workout: {
  status?: string;
  origin?: string;
  sets?: { status: string }[];
}) {
  return (
    workout.status === 'completed' &&
    workout.origin !== 'recorded-set' &&
    (!workout.sets?.length ||
      workout.sets.some((set) => set.status === 'completed'))
  );
}
export function expectedSets(prescription?: string) {
  return Math.min(
    10,
    Math.max(1, Number(prescription?.match(/^(\d+)\s*[×x]/i)?.[1] ?? 1)),
  );
}

export function validCalendarDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}
export function shiftCalendarDate(date: string, days: number) {
  if (!validCalendarDate(date)) return '';
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function calendarWeekday(date: string) {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}
/** Planned sessions belong to their selected weekday in the week they started.
 * Recordings belong to their performed date. Neither is a recurring weekly log.
 */
export function workoutCalendarDate(workout: Pick<WorkoutRecord, 'startedAt' | 'origin' | 'dayIndex' | 'scheduledDate' | 'timezone' | 'activityDate'>, timezone = 'UTC') {
  if (workout.origin === 'planned' && workout.scheduledDate && validCalendarDate(workout.scheduledDate)) return workout.scheduledDate;
  const started = activityDate(workout.startedAt, workout.timezone || timezone);
  if (workout.origin === 'planned' && Number.isInteger(workout.dayIndex) && workout.dayIndex! >= 0 && workout.dayIndex! <= 6)
    return shiftCalendarDate(started, workout.dayIndex! - calendarWeekday(started));
  return workout.activityDate && validCalendarDate(workout.activityDate) ? workout.activityDate : started;
}
export function setProgress(exercises: Pick<WorkoutExercise, 'exerciseId' | 'sets'>[], results: Pick<SetResult, 'exerciseId' | 'setIndex' | 'status'>[]) {
  const slots = new Map<string, 'completed' | 'skipped' | undefined>();
  for (const exercise of exercises) for (let index = 0; index < exercise.sets; index++) slots.set(`${exercise.exerciseId}:${index}`, undefined);
  for (const result of results) {
    const key = `${result.exerciseId}:${result.setIndex}`;
    if (slots.has(key) && slots.get(key) !== 'completed' && (result.status === 'completed' || result.status === 'skipped')) slots.set(key, result.status);
  }
  const completed = [...slots.values()].filter(status => status === 'completed').length;
  const skipped = [...slots.values()].filter(status => status === 'skipped').length;
  return { total: slots.size, completed, skipped, reviewed: completed + skipped, remaining: slots.size - completed - skipped };
}
export function plannedDayResults(workouts: WorkoutRecord[], programVersion: string | undefined, dayIndex: number, date: string, timezone = 'UTC') {
  return workouts.filter(workout => workout.origin === 'planned' &&
    (workout.status === 'active' || workout.status === 'completed') &&
    workout.programVersion === programVersion && workout.dayIndex === dayIndex &&
    workoutCalendarDate(workout, timezone) === date).flatMap(workout => workout.sets ?? []);
}
