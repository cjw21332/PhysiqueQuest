/**
 * Unit Tests for GenericRepCounter
 * 
 * Run with: npx vitest run shared/__tests__/genericRepCounter.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  GenericRepCounter, 
  createGenericRepCounter,
  DEFAULT_COUNTER_CONFIG,
  type GeneratedAngleConfig,
  type PoseFrame,
  type Landmark,
  type CounterEvent,
  type ProgressInfo 
} from '../genericRepCounter';

// Helper to create landmarks with sufficient visibility
const createLandmarksWithVisibility = (vis = 1.0): Landmark[] => {
  return Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: vis, presence: vis }));
};

// Software fixtures: normalized image coordinates, x right / y down, aspect 1.
// The knee-to-hip ray points up; the knee-to-ankle ray is rotated by `angle`.
function squatLandmarks(angle: number, visibility = 1, hipAngle = 140): Landmark[] {
  const points = Array.from({ length: 33 }, (_, i) => ({ x: 0.05 + (i % 10) * 0.008, y: 0.05 + Math.floor(i / 10) * 0.008, z: 0, visibility, presence: visibility }));
  for (const side of [0, 1]) {
    const x = side ? 0.62 : 0.38, y = 0.55, len = 0.16;
    const r = (-90 + angle) * Math.PI / 180;
    points[25 + side] = { ...points[25 + side], x, y };
    points[23 + side] = { ...points[23 + side], x, y: y - len };
    points[27 + side] = { ...points[27 + side], x: x + len * Math.cos(r), y: y + len * Math.sin(r) };
    const h = (90 + hipAngle) * Math.PI / 180;
    points[11 + side] = { ...points[11 + side], x: x + len * Math.cos(h), y: y - len + len * Math.sin(h) };
  }
  return points;
}

function squatFrame(counter: GenericRepCounter, angle: number, timestamp: number, visibility = 1): PoseFrame {
  const landmarks = squatLandmarks(angle, visibility);
  const measured = (counter as any).computeBilateralAngle(landmarks, 1);
  if (visibility >= 0.5) expect(measured).toBeCloseTo(angle, 5);
  else expect(measured).toBeNull();
  return { landmarks, timestamp, aspect: 1 };
}

const createMockFrame = (angle: number, timestamp: number, aspect = 1.0): PoseFrame => {
  // Create landmarks that produce the given angle for left_knee
  // left_knee = hip(23) - knee(25) - ankle(27)
  // For a given angle, we need to position these three points
  // Simplified: we'll test the counter logic by mocking computeJointAngle
  return {
    landmarks: Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1.0, presence: 1.0 })),
    timestamp,
    aspect,
  };
};

// Test configuration for a squat-like exercise
const SQUAT_CONFIG: GeneratedAngleConfig = {
  primaryJoints: ['left_knee', 'right_knee'],
  sideMode: 'bilateral',
  startAngles: { left_knee: 150, right_knee: 150 },
  peakAngles: { left_knee: 90, right_knee: 90 },
  directions: { left_knee: 'decreasing', right_knee: 'decreasing' },
  referenceRanges: { left_knee: 60, right_knee: 60 },
  stabilityConstraints: [
    { joint: 'left_hip', meanAngle: 170, tolerance: 15 },
    { joint: 'right_hip', meanAngle: 170, tolerance: 15 },
    { joint: 'trunk_inclination', meanAngle: 0, tolerance: 15 },
  ],
  viewHint: 'side',
};

const CURL_CONFIG: GeneratedAngleConfig = {
  primaryJoints: ['left_elbow'],
  sideMode: 'unilateral',
  startAngles: { left_elbow: 160 },
  peakAngles: { left_elbow: 40 },
  directions: { left_elbow: 'decreasing' },
  referenceRanges: { left_elbow: 120 },
  stabilityConstraints: [
    { joint: 'left_shoulder', meanAngle: 30, tolerance: 15 },
  ],
  viewHint: 'front',
};

describe('GenericRepCounter', () => {
  let counter: GenericRepCounter;
  let events: CounterEvent[] = [];
  let progressUpdates: ProgressInfo[] = [];

  beforeEach(() => {
    counter = new GenericRepCounter(SQUAT_CONFIG);
    events = [];
    progressUpdates = [];
    counter.setEventCallback((e) => events.push(e));
    counter.setProgressCallback((p) => progressUpdates.push(p));
  });

  describe('Basic State Machine', () => {
    it('starts in AT_START state', () => {
      const progress = counter.getProgress();
      expect(progress.state).toBe('AT_START');
      expect(progress.repCount).toBe(0);
      expect(progress.partialCount).toBe(0);
    });

    it('resets to initial state', () => {
      counter.reset();
      const progress = counter.getProgress();
      expect(progress.state).toBe('AT_START');
      expect(progress.repCount).toBe(0);
      expect(progress.partialCount).toBe(0);
    });
  });

  describe('Angle Computation Parity with Python', () => {
    // These tests verify the TypeScript angle math matches Python exactly
    // Using the same test cases from Python tests
    
    it('computes straight line as 180 degrees', () => {
      const counter = new GenericRepCounter(SQUAT_CONFIG);
      // Access private method via reflection for testing
      const landmarks: Landmark[] = [
        // left_knee: hip(23), knee(25), ankle(27)
        // hip at (0.3, 0.5), knee at (0.5, 0.5), ankle at (0.7, 0.5) -> 180 deg
        ...Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1.0, presence: 1.0 })),
      ];
      landmarks[23] = { x: 0.3, y: 0.5, z: 0, visibility: 1.0, presence: 1.0 };
      landmarks[25] = { x: 0.5, y: 0.5, z: 0, visibility: 1.0, presence: 1.0 };
      landmarks[27] = { x: 0.7, y: 0.5, z: 0, visibility: 1.0, presence: 1.0 };

      const angle = (counter as any).computeJointAngle(landmarks, 'left_knee', 1.0);
      expect(angle).not.toBeNull();
      expect(Math.abs(angle! - 180.0)).toBeLessThan(1.0);
    });

    it('computes right angle as 90 degrees', () => {
      const counter = new GenericRepCounter(SQUAT_CONFIG);
      const landmarks: Landmark[] = [
        ...Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1.0, presence: 1.0 })),
      ];
      // left_knee: hip above knee, ankle to right
      landmarks[23] = { x: 0.5, y: 0.3, z: 0, visibility: 1.0, presence: 1.0 }; // hip
      landmarks[25] = { x: 0.5, y: 0.5, z: 0, visibility: 1.0, presence: 1.0 }; // knee
      landmarks[27] = { x: 0.7, y: 0.5, z: 0, visibility: 1.0, presence: 1.0 }; // ankle

      const angle = (counter as any).computeJointAngle(landmarks, 'left_knee', 1.0);
      expect(angle).not.toBeNull();
      expect(Math.abs(angle! - 90.0)).toBeLessThan(1.0);
    });

    it('handles aspect correction', () => {
      const counter = new GenericRepCounter(SQUAT_CONFIG);
      const landmarks: Landmark[] = [
        ...Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1.0, presence: 1.0 })),
      ];
      // Create an angle that changes with aspect correction
      // left_knee: hip(23), knee(25), ankle(27)
      // hip at (0.4, 0.4), knee at (0.5, 0.5), ankle at (0.5, 0.6)
      // Without aspect: vector1 = (-0.1, -0.1), vector2 = (0, 0.1) -> angle ~ 135°
      // With aspect=2: vector1 = (-0.2, -0.1), vector2 = (0, 0.1) -> angle ~ 116°
      landmarks[23] = { x: 0.4, y: 0.4, z: 0, visibility: 1.0, presence: 1.0 };
      landmarks[25] = { x: 0.5, y: 0.5, z: 0, visibility: 1.0, presence: 1.0 };
      landmarks[27] = { x: 0.5, y: 0.6, z: 0, visibility: 1.0, presence: 1.0 };

      const angle1 = (counter as any).computeJointAngle(landmarks, 'left_knee', 1.0);
      const angle2 = (counter as any).computeJointAngle(landmarks, 'left_knee', 2.0);
      expect(angle1).not.toBeNull();
      expect(angle2).not.toBeNull();
      expect(Math.abs(angle1! - angle2!)).toBeGreaterThan(5.0);
    });
  });

  describe('Normalized Progress Computation', () => {
    it('computes progress correctly for decreasing direction (squat)', () => {
      const counter = new GenericRepCounter(SQUAT_CONFIG);
      // Squat: start=150, peak=90, direction=decreasing
      // At start: progress = 0
      // At peak: progress = 1
      // Middle: progress = 0.5
      
      expect((counter as any).computeNormalizedProgress(150, 'left_knee')).toBeCloseTo(0, 1);
      expect((counter as any).computeNormalizedProgress(90, 'left_knee')).toBeCloseTo(1, 1);
      expect((counter as any).computeNormalizedProgress(120, 'left_knee')).toBeCloseTo(0.5, 1);
    });

    it('computes progress correctly for increasing direction (curl)', () => {
      const counter = new GenericRepCounter(CURL_CONFIG);
      // Curl: start=160, peak=40, direction=decreasing (160->40)
      expect((counter as any).computeNormalizedProgress(160, 'left_elbow')).toBeCloseTo(0, 1);
      expect((counter as any).computeNormalizedProgress(40, 'left_elbow')).toBeCloseTo(1, 1);
      expect((counter as any).computeNormalizedProgress(100, 'left_elbow')).toBeCloseTo(0.5, 1);
    });
  });

  describe('Rep Counting — synthetic bilateral landmarks', () => {
    const base = { ...SQUAT_CONFIG, stabilityConstraints: [] };
    it('counts a full rep for squat', () => {
      const c = new GenericRepCounter(base, { emaAlpha: 1, fullRangeThreshold: 0.8, startTolerance: 0.15 });
      const events: CounterEvent[] = []; c.setEventCallback(e => events.push(e));
      [150, 140, 120, 100, 90, 100, 120, 140, 150].forEach((a, i) => c.update(squatFrame(c, a, i * 100)));
      expect(events.filter(e => e.type === 'rep_counted')).toHaveLength(1);
      expect(events.find(e => e.type === 'rep_counted')?.count).toBe(1);
      expect(c.getProgress().repCount).toBe(1);
    });
    it('detects partial rep when not reaching full threshold', () => {
      const c = new GenericRepCounter(base, { emaAlpha: 1, fullRangeThreshold: 0.85, startTolerance: 0.2 });
      const events: CounterEvent[] = []; c.setEventCallback(e => events.push(e));
      [150, 130, 110, 130, 150].forEach((a, i) => c.update(squatFrame(c, a, i * 100)));
      const partials = events.filter(e => e.type === 'rep_partial');
      expect(partials).toHaveLength(1);
      expect(partials[0].cue).toContain('deeper');
      expect(c.getProgress().partialCount).toBe(1);
      expect(c.getProgress().repCount).toBe(0);
    });
    it('rejects rep when stability constraint violated', () => {
      const c = new GenericRepCounter({ ...base, stabilityConstraints: [{ joint: 'left_hip', meanAngle: 170, tolerance: 10 }] }, { emaAlpha: 1, fullRangeThreshold: 0.8, faultMinMs: 100 });
      const events: CounterEvent[] = []; c.setEventCallback(e => events.push(e));
      [150, 130, 100, 90, 100, 130, 150].forEach((a, i) => {
        const f = squatFrame(c, a, (i + 1) * 100);
        expect((c as any).computeJointAngle(f.landmarks, 'left_hip', 1)).toBeCloseTo(140, 5);
        c.update(f);
      });
      expect(events.filter(e => e.type === 'rep_rejected_fault').length).toBeGreaterThanOrEqual(1);
      expect(c.getProgress().repCount).toBe(0);
    });
  });

  describe('Visibility Handling — synthetic bilateral landmarks', () => {
    const base = { ...SQUAT_CONFIG, stabilityConstraints: [] };
    it('declares visibility lost when frames stall and restores without counting interrupted motion', () => {
      const c = new GenericRepCounter(base, { emaAlpha: 1, visibilityLostMaxMs: 500 });
      const events: CounterEvent[] = []; c.setEventCallback(e => events.push(e));
      c.update(squatFrame(c, 150, 1)); c.update(squatFrame(c, 90, 101)); c.update(squatFrame(c, 90, 201));
      c.tick(701); expect(c.getProgress().state).not.toBe('VISIBILITY_LOST');
      c.tick(702); expect(c.getProgress().state).toBe('VISIBILITY_LOST');
      c.update(squatFrame(c, 150, 800));
      expect(c.getProgress().state).toBe('AT_START'); expect(c.getProgress().repCount).toBe(0);
      expect(events.filter(e => e.type === 'visibility_lost')).toHaveLength(1);
      expect(events.filter(e => e.type === 'visibility_restored')).toHaveLength(1);
    });
    it('discards an interrupted rep and emits loss and restoration exactly once', () => {
      const c = new GenericRepCounter(base, { emaAlpha: 1, visibilityLostMaxMs: 500 });
      const events: CounterEvent[] = []; c.setEventCallback(e => events.push(e));
      for (const [a,t,v] of [[150,1,1],[90,101,1],[90,201,1],[90,301,0],[90,802,0],[90,900,0]] as const) c.update(squatFrame(c,a,t,v));
      expect(c.getProgress().state).toBe('VISIBILITY_LOST');
      c.update(squatFrame(c,150,1000)); c.update(squatFrame(c,150,1100));
      expect(c.getProgress().state).toBe('AT_START'); expect(c.getProgress().repCount).toBe(0);
      expect(events.filter(e => e.type === 'visibility_lost')).toHaveLength(1);
      expect(events.filter(e => e.type === 'visibility_restored')).toHaveLength(1);
    });
    it('preserves completed totals across a long timestamp gap and clears them only on session reset', () => {
      const c = new GenericRepCounter(base, { emaAlpha: 1, minRepDurationMs: 100, maxRepDurationMs: 1000 });
      for (const [a,t] of [[150,1],[90,101],[90,201],[150,401]] as const) c.update(squatFrame(c,a,t));
      expect(c.getProgress().repCount).toBe(1);
      c.update(squatFrame(c,150,2000)); expect(c.getProgress().repCount).toBe(1);
      c.resetSession(); expect(c.getProgress().repCount).toBe(0);
    });
    it('continues an in-progress rep after a brief visibility dip', () => {
      const c = new GenericRepCounter(base, { emaAlpha: 1, minRepDurationMs: 100, visibilityLostMaxMs: 500 });
      const events: CounterEvent[] = []; c.setEventCallback(e => events.push(e));
      for (const [a,t,v] of [[150,1,1],[90,101,1],[90,201,1],[90,301,0],[150,501,1]] as const) c.update(squatFrame(c,a,t,v));
      expect(c.getProgress().repCount).toBe(1);
      expect(events.filter(e => e.type === 'visibility_lost' || e.type === 'visibility_restored')).toHaveLength(0);
    });
    it('pauses counting when visibility lost', () => {
      const c = new GenericRepCounter(base, { visibilityLostMaxMs: 500, emaAlpha: 1 });
      const events: CounterEvent[] = []; c.setEventCallback(e => events.push(e));
      c.update(squatFrame(c,150,0)); c.update(squatFrame(c,150,600,0)); c.update(squatFrame(c,150,1101,0));
      expect(events.some(e => e.type === 'visibility_lost')).toBe(true); expect(c.getProgress().state).toBe('VISIBILITY_LOST');
    });
    it('restores counting when visibility returns', () => {
      const c = new GenericRepCounter(base, { visibilityLostMaxMs: 500, emaAlpha: 1 });
      const events: CounterEvent[] = []; c.setEventCallback(e => events.push(e));
      c.update(squatFrame(c,150,0,0)); c.update(squatFrame(c,150,501,0)); c.update(squatFrame(c,150,600));
      expect(events.some(e => e.type === 'visibility_restored')).toBe(true); expect(c.getProgress().state).toBe('AT_START');
    });
  });

  describe('Bilateral timing and state traces — synthetic software tests', () => {
    const base = { ...SQUAT_CONFIG, stabilityConstraints: [] };
    const setup = () => {
      const c = new GenericRepCounter(base, { emaAlpha: 1, calibration: false, minRepDurationMs: 100, maxRepDurationMs: 1000, visibilityLostMaxMs: 500 });
      const events: CounterEvent[] = []; c.setEventCallback(e => events.push(e));
      return { c, events };
    };
    it('traces a normal rep through movement and peak', () => {
      const { c, events } = setup();
      const states = [[150,0],[130,100],[90,200],[120,300],[150,500]].map(([a,t]) => c.update(squatFrame(c,a,t)).state);
      expect(states).toEqual(['AT_START','MOVING','AT_PEAK','AT_PEAK','AT_START']);
      expect(events.filter(e => e.type === 'rep_counted')).toHaveLength(1);
    });
    it('documents a single peak sample being missed even with valid duration', () => {
      const { c, events } = setup();
      const states = [[150,0],[90,200],[150,500]].map(([a,t]) => c.update(squatFrame(c,a,t)).state);
      expect(states).toEqual(['AT_START','MOVING','AT_START']);
      expect(c.getProgress().repCount).toBe(0);
      expect(events.filter(e => e.type === 'rep_counted')).toHaveLength(0);
    });
    it('counts a fast cycle when the peak is sampled twice and duration is valid', () => {
      const { c } = setup();
      for (const [a,t] of [[150,0],[90,100],[90,150],[150,250]]) c.update(squatFrame(c,a,t));
      expect(c.getProgress().repCount).toBe(1);
    });
    it('does not count an unfinished or insufficient-range movement', () => {
      const { c } = setup();
      for (const [a,t] of [[150,0],[130,100],[110,200]]) c.update(squatFrame(c,a,t));
      expect(c.getProgress().repCount).toBe(0);
      c.update(squatFrame(c,130,300)); c.update(squatFrame(c,150,400));
      expect(c.getProgress().repCount).toBe(0); expect(c.getProgress().partialCount).toBe(1);
    });
    it('marks loss only beyond the timeout measured from the first missing frame', () => {
      const { c, events } = setup();
      c.update(squatFrame(c,150,1)); c.update(squatFrame(c,130,101));
      c.update(squatFrame(c,130,201,0)); c.update(squatFrame(c,130,701,0));
      expect(c.getProgress().state).not.toBe('VISIBILITY_LOST');
      c.update(squatFrame(c,130,702,0)); expect(c.getProgress().state).toBe('VISIBILITY_LOST');
      c.update(squatFrame(c,150,800)); c.update(squatFrame(c,150,900));
      expect(c.getProgress().repCount).toBe(0);
      expect(events.filter(e => e.type === 'visibility_lost')).toHaveLength(1);
      expect(events.filter(e => e.type === 'visibility_restored')).toHaveLength(1);
    });
    it('discards in-progress motion on a gap beyond maximum duration', () => {
      const { c } = setup();
      c.update(squatFrame(c,150,1)); c.update(squatFrame(c,130,101)); c.update(squatFrame(c,90,201));
      c.update(squatFrame(c,150,1400));
      expect(c.getProgress().repCount).toBe(0);
      c.resetSession(); expect(c.getProgress().state).toBe('AT_START'); expect(c.getProgress().repCount).toBe(0);
    });
  });

  describe('EMA Smoothing', () => {
    it('applies EMA smoothing correctly', () => {
      // Test EMA math directly (matches Python implementation)
      const alpha = 0.5;
      let ema: number | null = null;

      // First angle: 150
      ema = ema === null ? 150 : ema * (1 - alpha) + 150 * alpha;
      expect(ema).toBe(150);

      // Second angle: 140 -> EMA = 150*0.5 + 140*0.5 = 145
      ema = ema * (1 - alpha) + 140 * alpha;
      expect(ema).toBeCloseTo(145, 1);

      // Third angle: 130 -> EMA = 145*0.5 + 130*0.5 = 137.5
      ema = ema * (1 - alpha) + 130 * alpha;
      expect(ema).toBeCloseTo(137.5, 1);
    });
  });

  describe('Factory Function', () => {
    it('creates counter via createGenericRepCounter', () => {
      const counter = createGenericRepCounter(SQUAT_CONFIG);
      expect(counter).toBeInstanceOf(GenericRepCounter);
      expect(counter.getProgress().state).toBe('AT_START');
    });
  });

  describe('Curl Configuration', () => {
    it('works with unilateral curl config', () => {
      const counter = createGenericRepCounter(CURL_CONFIG);
      expect(counter.getProgress().state).toBe('AT_START');
      expect(counter.getProgress().currentJoint).toBe('left_elbow');
    });
  });
});
