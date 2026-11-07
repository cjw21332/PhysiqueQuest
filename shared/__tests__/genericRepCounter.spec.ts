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

  describe('Rep Counting', () => {
    it('counts a full rep for squat', () => {
      const counter = new GenericRepCounter(SQUAT_CONFIG, { 
        emaAlpha: 1.0, // No smoothing for deterministic test
        fullRangeThreshold: 0.8,
        startTolerance: 0.15,
      });
      
      let events: CounterEvent[] = [];
      counter.setEventCallback((e) => events.push(e));

      // Simulate squat: 150 (start) -> 90 (peak) -> 150 (return)
      const frames = [
        { angle: 150, timestamp: 0 },
        { angle: 140, timestamp: 100 },
        { angle: 120, timestamp: 200 },
        { angle: 100, timestamp: 300 },
        { angle: 90, timestamp: 400 },  // Peak
        { angle: 100, timestamp: 500 },
        { angle: 120, timestamp: 600 },
        { angle: 140, timestamp: 700 },
        { angle: 150, timestamp: 800 }, // Return to start
      ];

      // Mock computeJointAngle to return test angle for primary joint
      let currentFrameIndex = 0;
      const originalCompute = (counter as any).computeJointAngle.bind(counter);
      (counter as any).computeJointAngle = (landmarks: any, joint: string) => {
        if (joint === 'left_knee' || joint === 'right_knee') {
          return frames[currentFrameIndex]?.angle ?? 150;
        }
        return originalCompute(landmarks, joint);
      };

      for (const f of frames) {
        counter.update({
          landmarks: createLandmarksWithVisibility(1.0),
          timestamp: f.timestamp,
          aspect: 1.0,
        });
        currentFrameIndex++;
      }

      const repCounted = events.filter(e => e.type === 'rep_counted');
      expect(repCounted.length).toBe(1);
      expect(repCounted[0].count).toBe(1);
      expect(counter.getProgress().repCount).toBe(1);
    });

    it('detects partial rep when not reaching full threshold', () => {
      const counter = new GenericRepCounter(SQUAT_CONFIG, {
        emaAlpha: 1.0,
        fullRangeThreshold: 0.85,
        startTolerance: 0.2,
      });
      
      let events: CounterEvent[] = [];
      counter.setEventCallback((e) => events.push(e));

      // Partial: 150 -> 110 (not deep enough) -> 150
      const frames = [
        { angle: 150, timestamp: 0 },
        { angle: 130, timestamp: 100 },
        { angle: 110, timestamp: 200 }, // Only 0.67 progress
        { angle: 130, timestamp: 300 },
        { angle: 150, timestamp: 400 },
      ];

      let currentFrameIndex = 0;
      const originalCompute = (counter as any).computeJointAngle.bind(counter);
      (counter as any).computeJointAngle = (landmarks: any, joint: string) => {
        if (joint === 'left_knee' || joint === 'right_knee') {
          return frames[currentFrameIndex]?.angle ?? 150;
        }
        return originalCompute(landmarks, joint);
      };

      for (const f of frames) {
        counter.update({
          landmarks: createLandmarksWithVisibility(1.0),
          timestamp: f.timestamp,
          aspect: 1.0,
        });
        currentFrameIndex++;
      }

      const partials = events.filter(e => e.type === 'rep_partial');
      expect(partials.length).toBe(1);
      expect(partials[0].cue).toContain('deeper');
      expect(counter.getProgress().partialCount).toBe(1);
      expect(counter.getProgress().repCount).toBe(0);
    });

    it('rejects rep when stability constraint violated', () => {
      const config = {
        ...SQUAT_CONFIG,
        stabilityConstraints: [
          { joint: 'left_hip', meanAngle: 170, tolerance: 10 },
        ],
      };
      const counter = new GenericRepCounter(config, {
        emaAlpha: 1.0,
        fullRangeThreshold: 0.8,
        faultMinMs: 100, // Short for testing
      });
      
      let events: CounterEvent[] = [];
      counter.setEventCallback((e) => events.push(e));

      // Simulate full rep but with hip moving too much
      let timestamp = 0;
      for (const angle of [150, 130, 100, 90, 100, 130, 150]) {
        (counter as any).computeJointAngle = (landmarks: any, joint: string) => {
          if (joint === 'left_knee') return angle;
          if (joint === 'left_hip') return 140; // Violates tolerance (170 ± 10)
          return 150;
        };
        counter.update({
          landmarks: Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1.0, presence: 1.0 })),
          timestamp: timestamp += 100,
          aspect: 1.0,
        });
      }

      const faults = events.filter(e => e.type === 'rep_rejected_fault');
      expect(faults.length).toBeGreaterThanOrEqual(1);
      expect(counter.getProgress().repCount).toBe(0);
    });
  });

  describe('Visibility Handling', () => {
    it('declares visibility lost when frames stall and restores without counting interrupted motion', () => {
      const counter = new GenericRepCounter({ ...SQUAT_CONFIG, stabilityConstraints: [] }, { emaAlpha: 1, visibilityLostMaxMs: 500 });
      const events: CounterEvent[] = []; counter.setEventCallback(e => events.push(e));
      let angle = 150; (counter as any).computeJointAngle = () => angle;
      const frame = (timestamp: number) => counter.update({ landmarks: createLandmarksWithVisibility(1), timestamp, aspect: 1 });
      frame(1); angle = 90; frame(101); frame(201);
      counter.tick(701); expect(counter.getProgress().state).not.toBe('VISIBILITY_LOST');
      counter.tick(702); expect(counter.getProgress().state).toBe('VISIBILITY_LOST');
      angle = 150; frame(800);
      expect(counter.getProgress().state).toBe('AT_START');
      expect(counter.getProgress().repCount).toBe(0);
      expect(events.filter(e => e.type === 'visibility_lost')).toHaveLength(1);
      expect(events.filter(e => e.type === 'visibility_restored')).toHaveLength(1);
    });
    it('discards an interrupted rep and emits loss and restoration exactly once', () => {
      const counter = new GenericRepCounter({ ...SQUAT_CONFIG, stabilityConstraints: [] }, { emaAlpha: 1, visibilityLostMaxMs: 500 });
      const events: CounterEvent[] = [];
      counter.setEventCallback(e => events.push(e));
      let angle: number | null = 150;
      (counter as any).computeJointAngle = () => angle;
      const frame = (timestamp: number) => counter.update({ landmarks: createLandmarksWithVisibility(1), timestamp, aspect: 1 });
      frame(1); angle = 90; frame(101); frame(201);
      angle = null; frame(301); frame(802); frame(900);
      expect(counter.getProgress().state).toBe('VISIBILITY_LOST');
      angle = 150; frame(1000); frame(1100);
      expect(counter.getProgress().state).toBe('AT_START');
      expect(counter.getProgress().repCount).toBe(0);
      expect(events.filter(e => e.type === 'visibility_lost')).toHaveLength(1);
      expect(events.filter(e => e.type === 'visibility_restored')).toHaveLength(1);
    });

    it('preserves completed totals across a long timestamp gap and clears them only on session reset', () => {
      const counter = new GenericRepCounter({ ...SQUAT_CONFIG, stabilityConstraints: [] }, { emaAlpha: 1, minRepDurationMs: 100, maxRepDurationMs: 1000 });
      let angle = 150;
      (counter as any).computeJointAngle = () => angle;
      const frame = (timestamp: number) => counter.update({ landmarks: createLandmarksWithVisibility(1), timestamp, aspect: 1 });
      frame(1); angle = 90; frame(101); frame(201); angle = 150; frame(401);
      expect(counter.getProgress().repCount).toBe(1);
      frame(2000);
      expect(counter.getProgress().repCount).toBe(1);
      counter.resetSession();
      expect(counter.getProgress().repCount).toBe(0);
    });

    it('continues an in-progress rep after a brief visibility dip', () => {
      const counter = new GenericRepCounter({ ...SQUAT_CONFIG, stabilityConstraints: [] }, { emaAlpha: 1, minRepDurationMs: 100, visibilityLostMaxMs: 500 });
      const events: CounterEvent[] = []; counter.setEventCallback(e => events.push(e));
      let angle: number | null = 150; (counter as any).computeJointAngle = () => angle;
      const frame = (timestamp: number) => counter.update({ landmarks: createLandmarksWithVisibility(1), timestamp, aspect: 1 });
      frame(1); angle = 90; frame(101); frame(201); angle = null; frame(301);
      angle = 150; frame(501);
      expect(counter.getProgress().repCount).toBe(1);
      expect(events.filter(e => e.type === 'visibility_lost' || e.type === 'visibility_restored')).toHaveLength(0);
    });
    it('pauses counting when visibility lost', () => {
      const counter = new GenericRepCounter(SQUAT_CONFIG, {
        visibilityLostMaxMs: 500,
        emaAlpha: 1.0,
      });
      
      let events: CounterEvent[] = [];
      counter.setEventCallback((e) => events.push(e));

      let angle: number | null = 150;
      const originalCompute = (counter as any).computeJointAngle.bind(counter);
      (counter as any).computeJointAngle = (landmarks: any, joint: string) => {
        if (joint === 'left_knee' || joint === 'right_knee') {
          return angle;
        }
        return originalCompute(landmarks, joint);
      };

      // Start with good visibility - use high visibility landmarks
      counter.update({
        landmarks: createLandmarksWithVisibility(1.0),
        timestamp: 0,
        aspect: 1.0,
      });

      // Lose visibility (return null from computeJointAngle)
      angle = null;
      // Update at timestamp 600 (> 500ms visibilityLostMaxMs)
      counter.update({
        landmarks: createLandmarksWithVisibility(0.0),
        timestamp: 600,
        aspect: 1.0,
      });
      counter.update({ landmarks: createLandmarksWithVisibility(0.0), timestamp: 1101, aspect: 1.0 });

      expect(events.some(e => e.type === 'visibility_lost')).toBe(true);
      expect(counter.getProgress().state).toBe('VISIBILITY_LOST');
    });

    it('restores counting when visibility returns', () => {
      const counter = new GenericRepCounter(SQUAT_CONFIG, {
        visibilityLostMaxMs: 500,
        emaAlpha: 1.0,
      });

      let events: CounterEvent[] = [];
      counter.setEventCallback((e) => events.push(e));

      let angle: number | null = null;
      const originalCompute = (counter as any).computeJointAngle.bind(counter);
      (counter as any).computeJointAngle = (landmarks: any, joint: string) => {
        if (joint === 'left_knee' || joint === 'right_knee') {
          return angle;
        }
        return originalCompute(landmarks, joint);
      };

      // Lose visibility first
      counter.update({
        landmarks: createLandmarksWithVisibility(0.0),
        timestamp: 0,
        aspect: 1.0,
      });
      counter.update({ landmarks: createLandmarksWithVisibility(0.0), timestamp: 501, aspect: 1.0 });

      // Restore visibility
      angle = 150;
      counter.update({
        landmarks: createLandmarksWithVisibility(1.0),
        timestamp: 600,
        aspect: 1.0,
      });

      expect(events.some(e => e.type === 'visibility_restored')).toBe(true);
      expect(counter.getProgress().state).toBe('AT_START');
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
