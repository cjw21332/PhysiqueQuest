import assert from 'node:assert/strict';
import test from 'node:test';
import { programWeek } from '../lib/programWeek.ts';
import type { ProgramDay, SavedProgram } from '../lib/api.ts';

const day = (id: string, weekday?: number, exercises = 1): ProgramDay => ({ id, title: id, weekday, exercises: Array.from({ length: exercises }, (_, index) => ({ exerciseId: `${id}-${index}`, name: 'Row', targetMuscle: 'Back', equipment: 'Cable', sets: 3, unit: 'kg' as const, restSets: 30, restNext: 30 })) });
const program = (days: ProgramDay[]): SavedProgram => ({ id: 'p', name: 'P', source: 'custom', days });
const schedule = (days: ProgramDay[]) => programWeek(program(days)).map(item => [item.day.id, item.dayIndex]);

test('days keep their weekday and are listed Monday to Sunday', () => {
  assert.deepEqual(schedule([day('Lower', 4), day('Push', 0), day('Pull', 1)]), [['Push', 0], ['Pull', 1], ['Lower', 4]]);
});

test('days without a weekday, or clashing with one, take the next free weekday', () => {
  assert.deepEqual(schedule([day('A', 0), day('B'), day('C', 0), day('D', 2)]), [['A', 0], ['B', 1], ['D', 2], ['C', 3]]);
});

test('days without exercises are left off the week, and at most seven days are placed', () => {
  assert.deepEqual(schedule([day('Empty', 0, 0), day('Push', 1)]), [['Push', 1]]);
  assert.equal(programWeek(program(Array.from({ length: 9 }, (_, index) => day(`D${index}`)))).length, 7);
});
