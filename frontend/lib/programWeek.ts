import type { ProgramDay, SavedProgram } from './api';

/**
 * Weekday (0 = Monday) for every program day that has exercises: its own weekday, otherwise the next free one.
 * The Programs overview lists days this way and "Use as my weekly plan" applies exactly this schedule.
 */
export function programWeek(program: SavedProgram) {
  const used = new Set<number>(), placed: { day: ProgramDay; dayIndex: number }[] = [], pending: ProgramDay[] = [];
  for (const day of program.days.filter(item => item.exercises.length)) {
    if (day.weekday !== undefined && !used.has(day.weekday)) { used.add(day.weekday); placed.push({ day, dayIndex: day.weekday }); }
    else pending.push(day);
  }
  for (const day of pending) {
    const free = [0, 1, 2, 3, 4, 5, 6].find(index => !used.has(index));
    if (free === undefined) break;
    used.add(free); placed.push({ day, dayIndex: free });
  }
  return placed.sort((a, b) => a.dayIndex - b.dayIndex);
}
