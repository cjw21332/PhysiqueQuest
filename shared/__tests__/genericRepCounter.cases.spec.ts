import { describe, expect, it } from 'vitest';
import { GenericRepCounter, type GeneratedAngleConfig, type Landmark } from '../genericRepCounter';

const config = (joint: 'knee' | 'elbow', mode: GeneratedAngleConfig['sideMode'], start = 160, peak = 80): GeneratedAngleConfig => {
  const joints = [`left_${joint}`, `right_${joint}`];
  return { primaryJoints: mode === 'unilateral' ? joints.slice(0, 1) : joints, sideMode: mode,
    startAngles: Object.fromEntries(joints.map(j => [j, start])), peakAngles: Object.fromEntries(joints.map(j => [j, peak])),
    directions: Object.fromEntries(joints.map(j => [j, peak > start ? 'increasing' : 'decreasing'])),
    referenceRanges: Object.fromEntries(joints.map(j => [j, Math.abs(peak - start)])), stabilityConstraints: [], viewHint: 'side' };
};

function frame(joint: 'knee' | 'elbow', left: number, right: number, visibility = 1): Landmark[] {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility, presence: visibility }));
  for (const [side, angle] of [[0, left], [1, right]] as const) {
    const [a, b, c] = joint === 'knee' ? [23 + side, 25 + side, 27 + side] : [11 + side, 13 + side, 15 + side];
    const x = side ? 0.7 : 0.3, y = 0.5, r = angle * Math.PI / 180;
    points[a] = { ...points[a], x: x + 0.15, y };
    points[b] = { ...points[b], x, y };
    points[c] = { ...points[c], x: x + 0.15 * Math.cos(r), y: y + 0.15 * Math.sin(r) };
  }
  return points;
}

function run(joint: 'knee' | 'elbow', mode: GeneratedAngleConfig['sideMode'], count: number, start = 160, peak = 80, alternate = false) {
  const counter = new GenericRepCounter(config(joint, mode, start, peak), { emaAlpha: 1 });
  let t = 0;
  const send = (l: number, r: number) => counter.update({ landmarks: frame(joint, l, r), timestamp: t += 100, aspect: 1 });
  send(start, start);
  for (let i = 0; i < count; i++) for (const fraction of [0.25, 0.5, 0.75, 1, 1, 0.75, 0.5, 0.25, 0, 0]) {
    const a = start + (peak - start) * fraction;
    send(alternate && i % 2 ? start : a, alternate && i % 2 === 0 ? start : a);
  }
  return counter;
}

describe('real landmark exercise cases', () => {
  it('alternating lunges: 5 left and 5 right = 10', () => expect(run('knee', 'alternating', 10, 160, 80, true).getProgress().repCount).toBe(10));
  it('bilateral squat: 3', () => expect(run('knee', 'bilateral', 3).getProgress().repCount).toBe(3));
  it('bilateral elbow curl: 3', () => expect(run('elbow', 'bilateral', 3).getProgress().repCount).toBe(3));
  it('unilateral curl ignores the other arm', () => {
    const counter = new GenericRepCounter(config('elbow', 'unilateral'), { emaAlpha: 1 }); let t = 0;
    const send = (left: number) => counter.update({ landmarks: frame('elbow', left, 80 + (t * 17 % 80)), timestamp: t += 100, aspect: 1 });
    send(160); for (let i = 0; i < 3; i++) for (const angle of [140, 120, 100, 80, 80, 100, 120, 140, 160, 160]) send(angle);
    expect(counter.getProgress().repCount).toBe(3);
  });
  it('extension direction: 3', () => expect(run('elbow', 'bilateral', 3, 80, 160).getProgress().repCount).toBe(3));
  it('partial range is flagged, with zero full reps', () => {
    const counter = new GenericRepCounter(config('knee', 'bilateral'), { emaAlpha: 1, calibration: false }); let t = 0;
    for (const a of [160, 140, 120, 105, 105, 120, 140, 160]) counter.update({ landmarks: frame('knee', a, a), timestamp: t += 100, aspect: 1 });
    expect(counter.getProgress().repCount).toBe(0); expect(counter.getProgress().partialCount).toBe(1);
  });
  it('rejects reps faster than 400ms and slower than 10s', () => {
    for (const step of [50, 2000]) {
      const counter = new GenericRepCounter(config('knee', 'bilateral'), { emaAlpha: 1, calibration: false }); let t = 0;
      for (const a of [160, 140, 100, 80, 80, 100, 140, 160]) counter.update({ landmarks: frame('knee', a, a), timestamp: t += step, aspect: 1 });
      expect(counter.getProgress().repCount).toBe(0);
    }
  });
  it('3% Gaussian landmark noise retains exactly 3 reps', () => {
    const counter = new GenericRepCounter(config('knee', 'bilateral'), { emaAlpha: 0.35 }); let t = 0, seed = 12345;
    const uniform = () => ((seed = (1664525 * seed + 1013904223) >>> 0) + 1) / 4294967297;
    const gaussian = () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
    const send = (angle: number) => {
      const landmarks = frame('knee', angle, angle).map(p => ({ ...p, x: p.x + gaussian() * 0.0045, y: p.y + gaussian() * 0.0045 }));
      counter.update({ landmarks, timestamp: t += 100, aspect: 1 });
    };
    for (let i = 0; i < 3; i++) for (const a of [160, 160, 150, 140, 130, 120, 110, 100, 90, 80, 80, 80, 80, 90, 100, 110, 120, 130, 140, 150, 160, 160, 160, 160]) send(a);
    expect(counter.getProgress().repCount).toBe(3);
  });
  it('brief visibility loss continues; long loss discards the rep', () => {
    for (const [gap, expected] of [[300, 1], [600, 0]] as const) {
      const counter = new GenericRepCounter(config('knee', 'bilateral'), { emaAlpha: 1 });
      const send = (angle: number, timestamp: number, visibility = 1) => counter.update({ landmarks: frame('knee', angle, angle, visibility), timestamp, aspect: 1 });
      send(160, 100); send(140, 200); send(100, 300); send(80, 400); send(80, 500); send(80, 600, 0);
      send(100, 600 + gap); send(140, 700 + gap); send(160, 800 + gap);
      expect(counter.getProgress().repCount).toBe(expected);
    }
  });
  it('140 degree rest and 60 degree ROM with calibration: 3', () => {
    const counter = new GenericRepCounter(config('knee', 'bilateral', 170, 90), { emaAlpha: 1 }); let t = 0;
    for (let i = 0; i < 3; i++) for (const a of [140, 125, 110, 95, 80, 95, 110, 125, 140, 140]) counter.update({ landmarks: frame('knee', a, a), timestamp: t += 100, aspect: 1 });
    console.log(`140-degree rest: expected=3 actual=${counter.getProgress().repCount}`);
    expect(counter.getProgress().repCount).toBe(3);
  });
  it('plank reports a 20 second hold and zero reps', () => {
    const counter = new GenericRepCounter({ ...config('knee', 'bilateral', 160, 160), isIsometric: true }, { emaAlpha: 1 });
    for (let t = 0; t <= 20000; t += 100) counter.update({ landmarks: frame('knee', 160, 160), timestamp: t, aspect: 1 });
    expect(counter.getProgress().holdDurationMs).toBeGreaterThanOrEqual(19000);
    expect(counter.getProgress().holdDurationMs).toBeLessThanOrEqual(21000);
    expect(counter.getProgress().repCount).toBe(0);
  });
  it('plank does not count time when landmarks are not visible', () => {
    const counter = new GenericRepCounter({ ...config('knee', 'bilateral', 160, 160), isIsometric: true }, { emaAlpha: 1 });
    for (let t = 0; t <= 2000; t += 100) counter.update({ landmarks: frame('knee', 160, 160), timestamp: t, aspect: 1 });
    counter.update({ landmarks: frame('knee', 160, 160, 0), timestamp: 2100, aspect: 1 });
    expect(counter.getProgress().holdDurationMs).toBe(1700);
    for (let t = 4000; t <= 5000; t += 100) counter.update({ landmarks: frame('knee', 160, 160), timestamp: t, aspect: 1 });
    expect(counter.getProgress().holdDurationMs).toBe(2400);
    expect(counter.getProgress().repCount).toBe(0);
  });
  it('plank rejects unstable angles and drifting hips inside tolerance', () => {
    for (const drift of [false, true]) {
      const counter = new GenericRepCounter({ ...config('knee', 'bilateral', 160, 160), isIsometric: true, holdStabilityFrames: 5, holdAngleStdDevDegrees: 2, holdHipDriftThreshold: 0.02 }, { emaAlpha: 1 });
      for (let t = 0; t <= 5000; t += 100) {
        const a = drift ? 160 : 160 + (t % 200 ? 6 : -6);
        const landmarks = frame('knee', a, a);
        if (drift) for (const point of landmarks) point.x += t * 0.0001;
        counter.update({ landmarks, timestamp: t, aspect: 1 });
      }
      expect(counter.getProgress().holdDurationMs).toBe(0);
      expect(counter.getProgress().repCount).toBe(0);
    }
  });
  it('jitter at rest never counts', () => {
    const counter = new GenericRepCounter(config('knee', 'bilateral'), { emaAlpha: 1 });
    for (let t = 0; t < 30000; t += 100) { const a = 140 + 3 * Math.sin(t / 200); counter.update({ landmarks: frame('knee', a, a), timestamp: t, aspect: 1 }); }
    expect(counter.getProgress().repCount).toBe(0);
  });
  it('deeper than reference range counts 3', () => {
    const counter = new GenericRepCounter(config('knee', 'bilateral', 150, 100), { emaAlpha: 1 }); let t = 0;
    for (let i = 0; i < 3; i++) for (const a of [150, 135, 120, 105, 90, 75, 90, 105, 120, 135, 150, 150]) counter.update({ landmarks: frame('knee', a, a), timestamp: t += 100, aspect: 1 });
    expect(counter.getProgress().repCount).toBe(3);
  });
  it('calibrated shallow reps count and carry partial quality', () => {
    const counter = new GenericRepCounter(config('knee', 'bilateral', 160, 60), { emaAlpha: 1 }); let t = 0;
    const events: Array<{ quality: string; romVsReference: number }> = [];
    counter.setEventCallback(e => { if (e.type === 'rep_counted') events.push(e); });
    for (let i = 0; i < 3; i++) for (const a of [160, 150, 140, 130, 120, 110, 100, 110, 120, 130, 140, 150, 160, 160]) counter.update({ landmarks: frame('knee', a, a), timestamp: t += 100, aspect: 1 });
    expect(counter.getProgress().repCount).toBe(3);
    expect(events.every(e => e.quality === 'partial' && e.romVsReference < 0.85)).toBe(true);
  });
  it('five seconds of fidgeting before exercise does not poison calibration', () => {
    const counter = new GenericRepCounter(config('knee', 'bilateral', 160, 80), { emaAlpha: 1 }); let t = 0;
    const send = (a: number) => counter.update({ landmarks: frame('knee', a, a), timestamp: t += 100, aspect: 1 });
    for (let i = 0; i < 50; i++) send(150 + 8 * Math.sin(i / 3));
    for (let i = 0; i < 3; i++) for (const a of [160, 140, 120, 100, 80, 80, 100, 120, 140, 160, 160]) send(a);
    expect(counter.getProgress().repCount).toBe(3);
  });
  it('slow weight shifts below 30 degrees count zero', () => {
    const counter = new GenericRepCounter(config('knee', 'bilateral'), { emaAlpha: 1 });
    for (let t = 0; t < 30000; t += 100) { const a = 150 + 10 * Math.sin(t / 2000); counter.update({ landmarks: frame('knee', a, a), timestamp: t, aspect: 1 }); }
    expect(counter.getProgress().repCount).toBe(0);
  });
  it('mixed full and shallow reps preserve count and quality', () => {
    const counter = new GenericRepCounter(config('knee', 'bilateral', 160, 80), { emaAlpha: 1 }); let t = 0;
    const qualities: string[] = [];
    counter.setEventCallback(e => { if (e.type === 'rep_counted') qualities.push(e.quality); });
    for (const peak of [80, 80, 110, 80]) for (const a of [160, 140, 120, peak, peak, 120, 140, 160, 160]) counter.update({ landmarks: frame('knee', a, a), timestamp: t += 100, aspect: 1 });
    expect(counter.getProgress().repCount).toBe(4);
    expect(qualities).toEqual(['full', 'full', 'partial', 'full']);
  });
  it.each(['AT_START', 'MOVING', 'AT_PEAK'] as const)('recalibrates after a sustained 20 degree shift from %s', state => {
    const counter = new GenericRepCounter(config('knee', 'bilateral', 160, 80), { emaAlpha: 1 }); let t = 0;
    const send = (a: number) => counter.update({ landmarks: frame('knee', a, a), timestamp: t += 100, aspect: 1 });
    for (let i = 0; i < 2; i++) for (const a of [160, 140, 120, 100, 80, 80, 100, 120, 140, 160, 160]) send(a);
    expect(counter.getProgress().repCount).toBe(2);
    if (state !== 'AT_START') send(130);
    if (state === 'AT_PEAK') { send(80); send(80); }
    expect(counter.getProgress().state).toBe(state);
    for (let i = 0; i < 30; i++) send(140);
    for (let i = 0; i < 3; i++) for (const a of [140, 125, 110, 95, 80, 80, 95, 110, 125, 140, 140]) send(a);
    expect(counter.getProgress().repCount).toBe(5);
  });
  it('does not recalibrate for a brief 20 degree shift', () => {
    const counter = new GenericRepCounter(config('knee', 'bilateral'), { emaAlpha: 1 }); let t = 0;
    const send = (a: number) => counter.update({ landmarks: frame('knee', a, a), timestamp: t += 100, aspect: 1 });
    for (let i = 0; i < 2; i++) for (const a of [160, 140, 120, 100, 80, 80, 100, 120, 140, 160, 160]) send(a);
    const prior = (counter as any).calibratedRest;
    for (let i = 0; i < 15; i++) send(140);
    for (let i = 0; i < 10; i++) send(160);
    expect((counter as any).calibratedRest).toBe(prior);
    expect(counter.getProgress().repCount).toBe(2);
  });
});
