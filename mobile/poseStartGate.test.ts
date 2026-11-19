import { describe, expect, it } from 'vitest';
import { createPoseStartGate, frameStatus, requiredLandmarks } from './poseStartGate';

describe('framing guidance', () => {
  const points = () => Array.from({ length: 33 }, (_, i) => ({ x: 0.5, y: i < 23 ? 0.2 : 0.7, visibility: 1 }));
  it('uses family-specific landmarks without requiring the nose', () => {
    expect(requiredLandmarks('curl')).toContain(15);
    expect(requiredLandmarks('squat')).toContain(27);
    expect(requiredLandmarks('horizontal_push')).not.toContain(15);
    for (const family of ['curl', 'squat', 'horizontal_push']) expect(requiredLandmarks(family)).not.toContain(0);
  });
  it('reports visible, far, cropped, and missing poses', () => {
    const p = points();
    expect(frameStatus('squat', p)).toBe('OK');
    const far = p.map(point => ({ ...point, y: 0.5 + (point.y - 0.5) * 0.2 }));
    expect(frameStatus('squat', far)).toBe('TOO_FAR');
    const cropped = points(); cropped[27].x = 0;
    expect(frameStatus('squat', cropped)).toBe('TOO_CLOSE');
    const missing = points(); missing[27].visibility = 0;
    expect(frameStatus('squat', missing)).toBe('NOT_VISIBLE');
  });
});

describe('pose start gate', () => {
  it('counts only after three seconds of visible body frames', () => {
    const gate = createPoseStartGate();
    expect(gate.update(0, true).countdown).toBe(3);
    for (let t = 100; t < 3000; t += 100) expect(gate.update(t, true).active).toBe(false);
    expect(gate.update(3000, true)).toEqual({ active: true, countdown: null });
  });
  it('does not count a brief detection gap as visible time and resets after a long gap', () => {
    const gate = createPoseStartGate();
    for (let t = 0; t <= 1000; t += 100) gate.update(t, true);
    gate.update(1100, false);
    expect(gate.update(1500, true).countdown).toBe(2);
    expect(gate.update(2400, true).countdown).toBe(3);
  });
  it('tolerates a brief lost frame during tracking but restarts after sustained loss', () => {
    const gate = createPoseStartGate();
    for (let t = 0; t <= 3000; t += 100) gate.update(t, true);
    expect(gate.update(3100, false).active).toBe(true);
    expect(gate.update(3200, true).active).toBe(true);
    expect(gate.update(4000, false).active).toBe(true);
    expect(gate.update(6301, false).active).toBe(false);
    expect(gate.update(6400, true).countdown).toBe(3);
  });
  it('keeps the gate active through a two-second loss and resets after four seconds', () => {
    const gate = createPoseStartGate();
    for (let t = 0; t <= 3000; t += 100) gate.update(t, true);
    expect(gate.update(5000, false).active).toBe(true);
    expect(gate.update(5000, true)).toEqual({ active: true, countdown: null });
    expect(gate.update(9001, false).active).toBe(false);
    expect(gate.update(9100, true).countdown).toBe(3);
  });
});
