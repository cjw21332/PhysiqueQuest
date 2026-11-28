import assert from 'node:assert/strict';
import test from 'node:test';
import { noteToProgram } from '../lib/noteProgram.ts';

// Transcribed from the user's phone note "Workout Program" (2026-11-25).
const NOTE = `Workout Program
PPLUL
PUSH
PULL
LEGS
UPPER
LOWER

PUSH DAY - 11/25/26
Start - 1:00 PM
End -  PM

3. Incline Chest Machine Press
Working set:
20 kg x 8 ✅
20 kg x 8 ✅
20 kg x 8 ✅

2. Dumbbell Shoulder Press
Working set:
15 kg x 8 ✅
15 kg x 8 ✅
12.5 kg x 10 ✅

1. Smith Machine Bench Press
Warmup set:
Smith machine bar x 10 ✅
Smith machine bar + 15 kg x 10 ✅

Working set:
Smith machine bar + 25 kg x 8 ✅
Smith machine bar + 25 kg x 10 ✅
smith machine bar + 25 kg x 10 ✅

4. Cable Lateral Raises
Working set:
17 lbs x 15 ✅
17 lbs x 13 ✅

PULL DAY - 11/12/26
1. Wide Grip Lat Pulldown
Warmup set:
55 lbs x 15 ✅

Working set:
77 lbs x 8 ✅
77 lbs x 8 ✅
88 lbs x 8 ✅

Leg Day

Start - 1:25 pm
End - 3:19 pm

Stretching:
- 5 mins treadmill
- Front to back leg swings

1. Deadlift (Conventional or Sumo): 5 sets x 5 reps
Working set:
70 kg x 5 ✅
70 kg x 5 ✅

6. Roman Chair Leg Raise: 3 sets x 10-20 reps
12 reps ✅
10 reps ✅

UPPER DAY WORKOUT

CHEST

1. Smith Machine Bench Press
Warm-up sets:
Smith Machine Bar × 10 ✅

Working sets:
Bar + 20 kg × 10 ✅
Bar + 30 kg × 4 ✅

BACK

3. Chest-Supported T-Bar Row
Working sets:
30 kg × 12 ✅
32.5 kg × 10 ✅`;

test('a phone workout note becomes a PPLUL draft program with working-set weights', () => {
  const program = noteToProgram(NOTE, 'prog_test', index => `day_${index}`, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  assert.ok(program);
  assert.equal(program.name, 'Workout Program');
  assert.deepEqual(program.days.map(day => [day.title, day.weekday]), [['Push', 0], ['Pull', 1], ['Legs', 2], ['Upper', 3]]);
  assert.match(program.notes ?? '', /No exercises were listed for: Lower/);

  const push = program.days[0].exercises;
  assert.deepEqual(push.map(item => item.name), ['Smith Machine Bench Press', 'Dumbbell Shoulder Press', 'Incline Chest Machine Press', 'Cable Lateral Raises']);
  // "Smith machine bar + 25 kg": 25 kg of plates on the bar, not 25 kg in total.
  assert.deepEqual({ sets: push[0].sets, reps: push[0].reps, weight: push[0].weight, loadBase: push[0].loadBase, unit: push[0].unit, equipment: push[0].equipment }, { sets: 3, reps: '8-10', weight: 25, loadBase: 'Bar', unit: 'kg', equipment: 'Smith machine' });
  assert.equal(push[1].loadBase, undefined, 'dumbbells have no bar');
  assert.deepEqual({ sets: push[3].sets, weight: push[3].weight, unit: push[3].unit }, { sets: 2, weight: 17, unit: 'lbs' });

  const pulldown = program.days[1].exercises[0];
  assert.deepEqual({ sets: pulldown.sets, reps: pulldown.reps, weight: pulldown.weight, unit: pulldown.unit }, { sets: 3, reps: '8', weight: 88, unit: 'lbs' });

  const legs = program.days[2].exercises;
  assert.deepEqual(legs.map(item => [item.name, item.sets, item.reps]), [['Deadlift', 5, '5'], ['Roman Chair Leg Raise', 3, '10-20']]);
  assert.equal(legs[1].weight, undefined);

  const upper = program.days[3].exercises;
  assert.deepEqual(upper.map(item => [item.name, item.targetMuscle, item.weight, item.loadBase]), [['Smith Machine Bench Press', 'Chest', 30, 'Bar'], ['Chest-Supported T-Bar Row', 'Back', 32.5, undefined]]);
  assert.ok(program.days.every(day => day.exercises.every(item => item.restSets === 30 && item.exerciseId.length <= 80)));
});

test('notes without exercises produce no program', () => {
  assert.equal(noteToProgram('Groceries\nmilk\neggs', 'p', i => `d${i}`), null);
});
