import { describe, expect, it } from 'vitest';
import { createRiskMonitor } from './poseRisk';
import { exerciseIntensity } from '../shared/exerciseIntensity';

describe('exercise intensity', () => {
  it('classifies loaded, cardio, hold and default movements', () => {
    expect(exerciseIntensity('Barbell Back Squat', 'squat')).toBe('high');
    expect(exerciseIntensity('Jumping Jack', 'jumping_jack')).toBe('high');
    expect(exerciseIntensity('Front Plank', 'plank', true)).toBe('low');
    expect(exerciseIntensity('Dumbbell Curl', 'curl')).toBe('moderate');
  });
});

describe('injury-risk monitor', () => {
  it('escalates repeated risky form sooner at high intensity', () => {
    const high = createRiskMonitor('high');
    expect(high.observe(['knee_valgus'], 0)).toBeNull();
    expect(high.observe(['knee_valgus'], 2000)?.id).toBe('knee_valgus');
    const moderate = createRiskMonitor('moderate');
    expect(moderate.observe(['knee_valgus'], 0)).toBeNull();
    expect(moderate.observe(['knee_valgus'], 2000)).toBeNull();
    expect(moderate.observe(['knee_valgus'], 4000)?.fix).toMatch(/knees out/);
  });
  it('tightens the threshold from age 35 and ignores non-risk cues', () => {
    const older = createRiskMonitor('moderate', 40);
    expect(older.observe(['depth', 'spine_neutral'], 0)).toBeNull();
    expect(older.observe(['spine_neutral'], 1000)?.kind).toBe('form');
  });
  it('forgets faults outside the window and cools down after an alert', () => {
    const m = createRiskMonitor('high');
    m.observe(['body_line'], 0);
    expect(m.observe(['body_line'], 25_000)).toBeNull();
    expect(m.observe(['body_line'], 26_000)?.id).toBe('body_line');
    m.observe(['body_line'], 27_000);
    expect(m.observe(['body_line'], 28_000)).toBeNull();
  });
  it('flags fatigue when reps slow well past the opening pace, once', () => {
    const m = createRiskMonitor('moderate');
    [0, 2000, 4000, 6000, 8000].forEach(t => expect(m.rep(t)).toBeNull());
    expect(m.rep(12_000)?.kind).toBe('fatigue');
    expect(m.rep(20_000)).toBeNull();
    m.reset();
    expect(m.rep(30_000)).toBeNull();
  });
  it('does not flag fatigue for low-intensity holds', () => {
    const m = createRiskMonitor('low');
    [0, 1000, 2000, 3000, 4000, 20_000].forEach(t => expect(m.rep(t)).toBeNull());
  });
});
