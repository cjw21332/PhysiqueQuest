import { describe, expect, it } from 'vitest';
import { CoachPlanner, LibraryExercise } from '../src/coach/coach-planner.js';

const record = (name: string, targetMuscle: string): LibraryExercise => ({ id: name, name, group: targetMuscle, targetMuscle, equipment: 'Dumbbells', instructions: ['Keep a steady position.'], pose: 'missing' });
const profile = { goal: 'Build muscle', days: ['Monday', 'Wednesday', 'Friday'], duration: '45 min', equipment: ['Dumbbells'], conditions: [] };

describe('provider-based movement curation', () => {
  it('uses primary body category and refuses mobility or incidental name matches as strength work', () => {
    const pool = [record('push-up inside leg kick', 'Legs'), record('potty squat', 'Core'), record('back pec stretch', 'Back'), record('upward facing dog', 'Back'), record('Dumbbell squat', 'Legs'), record('Dumbbell row', 'Back'), record('Biceps curl', 'Arms')];
    const days = new CoachPlanner().build(profile, pool).days.filter(day => day.isWorkoutDay);
    expect(days[1].exercises.map(item => item.name)).toEqual(['Dumbbell squat']);
    expect(days[2].exercises.map(item => item.name)).toEqual(expect.arrayContaining(['Dumbbell row', 'Biceps curl']));
    expect(days.flatMap(day => day.exercises).some(item => /potty|stretch|dog|inside leg kick/.test(item.name))).toBe(false);
  });

  it('selects one representative for each press family and favors basic moves', () => {
    const pool = [record('Chest Tap Push Up', 'Chest'), record('dumbbell arnold press', 'Shoulders'), record('dumbbell bench seated press', 'Shoulders'), record('dumbbell cuban press', 'Shoulders'), record('dumbbell decline hammer press', 'Chest'), record('dumbbell lying hammer press', 'Chest'), record('dumbbell bench press', 'Chest'), record('dumbbell shoulder press', 'Shoulders'), record('dumbbell lateral raise', 'Shoulders'), record('triceps extension', 'Arms')];
    const push = new CoachPlanner().build(profile, pool).days[0].exercises;
    expect(push.map(item => item.name)).toEqual(expect.arrayContaining(['dumbbell bench press', 'dumbbell shoulder press', 'dumbbell lateral raise', 'triceps extension']));
    expect(push.filter(item => /press/.test(item.name))).toHaveLength(2);
    expect(push.some(item => /cuban|chest tap/i.test(item.name))).toBe(false);
  });

  it('matches health exclusions across provider punctuation variants', () => {
    const pool = [record('dumbbell bent over row', 'Back'), record('Dumbbell bent-over row', 'Back'), record('dumbbell deadlift', 'Legs'), record('Biceps curl', 'Arms')];
    const plan = new CoachPlanner().build({ ...profile, conditions: ['Lower back pain'] }, pool);
    expect(plan.days.flatMap(day => day.exercises).map(item => item.name)).toEqual(['Biceps curl']);
  });

  it('uses actual cardio-category candidates for endurance sessions without strength-name filtering', () => {
    const pool = [record('stationary bike', 'Cardio'), record('walk', 'Cardio'), record('Dumbbell squat', 'Legs')];
    const endurance = new CoachPlanner().build({ ...profile, goal: 'Endurance', days: ['Monday', 'Wednesday', 'Friday', 'Saturday'] }, pool);
    const interval = endurance.days[0];
    const mix = endurance.days[5];
    expect(interval.exercises.map(item => item.name)).toEqual(expect.arrayContaining(['stationary bike', 'walk']));
    expect(mix.exercises.map(item => item.name)).toEqual(expect.arrayContaining(['stationary bike', 'walk']));
    expect(interval.exercises.every(item => item.prescription === '3 × 45 s')).toBe(true);
    const strength = new CoachPlanner().build(profile, pool);
    expect(strength.days.flatMap(day => day.exercises).some(item => item.targetMuscle === 'Cardio')).toBe(false);
  });

  it('puts basic compound work before accessories and rejects complex extra-equipment variants', () => {
    const pool = [record('dumbbell lateral raise', 'Shoulders'), record('dumbbell bench press', 'Chest'), record('push-up', 'Chest'), record('dumbbell upright row', 'Shoulders'), record('Dumbbell Biceps Curl Lunge With Bowling Motion', 'Arms'), record('Dumbbell Biceps Curl On Exercise Ball With Leg Raised', 'Arms'), record('Biceps curl', 'Arms'), record('inverse leg curl (on pull-up cable machine)', 'Legs')];
    const days = new CoachPlanner().build(profile, pool).days;
    const push = days[0].exercises.map(item => item.name);
    expect(push.indexOf('dumbbell bench press')).toBeLessThan(push.indexOf('dumbbell lateral raise'));
    expect(days.flatMap(day => day.exercises).some(item => /upright|bowling|exercise ball|inverse leg curl/i.test(item.name))).toBe(false);
  });
});
