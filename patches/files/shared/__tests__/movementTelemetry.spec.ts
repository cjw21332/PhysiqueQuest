import { describe, expect, it } from 'vitest';
import { createMovementTelemetry, projectMotionPoint } from '../movementTelemetry';
const points = () => Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1, presence: 1 }));
const sample = (timestamp: number, progress = 0, reps = 0) => ({ timestamp, progress, reps, partials: 0, visible: true, aspect: 1, landmarks: points() });
describe('display-only movement telemetry', () => {
  it('keeps body guides available while disabling timing for ambiguous working sides', () => {
    const observer = createMovementTelemetry(.18, .82, false);
    [0,.5,.9,.5,0].forEach((p,i)=>observer.update(sample(i*100+1,p,i===4?1:0)));
    expect(observer.snapshot().point).not.toBeNull();
    expect(observer.snapshot().current).toBeNull();
    expect(observer.snapshot().last).toBeNull();
  });
  it('requires stable observed start samples before drawing a reference', () => {
    const observer = createMovementTelemetry();
    for (let t = 1; t < 501; t += 100) expect(observer.update(sample(t)).reference).toBeNull();
    expect(observer.update(sample(501)).reference).toEqual({ x: .5, y: .5 });
  });
  it('never creates points or timing from absent confidence', () => {
    const observer = createMovementTelemetry();
    observer.update(sample(1));
    const hidden = sample(101, .5); hidden.landmarks.forEach(p => { p.visibility = .1; });
    expect(observer.update(hidden)).toMatchObject({ point: null, path: [], current: null, phase: 'unknown' });
  });
  it('bounds history and clears it on reacquisition and explicit subject/camera reset', () => {
    const observer = createMovementTelemetry();
    for (let t = 1; t < 10000; t += 10) observer.update(sample(t, .5));
    expect(observer.snapshot().path.length).toBeLessThanOrEqual(64);
    expect(observer.update(sample(12000, .5)).path).toHaveLength(1);
    observer.reset(); expect(observer.snapshot().path).toEqual([]);
  });
  it('records sampled timing only when the external engine reports a rep', () => {
    const observer = createMovementTelemetry();
    [0, .3, .7, .9, .9, .6, .3, 0].forEach((p, i) => observer.update(sample(i * 100 + 1, p)));
    expect(observer.snapshot().last).toBeNull();
    observer.reset();
    [0, .3, .7, .9, .9, .6, .3, 0].forEach((p, i) => observer.update(sample(i * 100 + 1, p, i === 7 ? 1 : 0)));
    expect(observer.snapshot().last).toEqual({ moveMs: 200, holdMs: 200, returnMs: 200, kind: 'full' });
  });
  it('does not time across loss or mutate supplied landmarks', () => {
    const observer = createMovementTelemetry(), original = sample(1);
    const before = JSON.stringify(original); observer.update(original);
    expect(JSON.stringify(original)).toBe(before);
    observer.update(sample(101, .4));
    observer.update({ ...sample(201, .9), visible: false });
    observer.update(sample(301, 0, 1));
    expect(observer.snapshot().last).toBeNull();
  });
  it('projects cover-cropped coordinates and applies exactly one mirror', () => {
    expect(projectMotionPoint({ x: .25, y: .5 }, 640, 480, 320, 240)).toEqual({ x: 80, y: 120 });
    expect(projectMotionPoint({ x: .25, y: .5 }, 640, 480, 320, 240, true)).toEqual({ x: 240, y: 120 });
    expect(projectMotionPoint({ x: .5, y: .5 }, 0, 480, 320, 240)).toBeNull();
  });
});
