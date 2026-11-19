import { describe, expect, it } from 'vitest';
import { createPoseSessionClock, parseNativePoseSummary } from '../poseSessionSummary';

describe('native tracking summary', () => {
  it('preserves distinct complete and partial counts and elapsed time', () => {
    expect(parseNativePoseSummary({ completeReps: 12, partialReps: 1, durationSeconds: 75, holdMs: null }))
      .toEqual({ completeReps: 12, partialReps: 1, durationSeconds: 75, holdMs: null });
    expect(parseNativePoseSummary({ completeReps: -1, partialReps: 1, durationSeconds: 75, holdMs: null })).toBeNull();
  });
  it('excludes paused time and does not reset elapsed time on resume', () => {
    let now = 0;
    const clock = createPoseSessionClock(() => now);
    clock.start(); now = 12000; clock.pause(); now = 22000;
    expect(clock.seconds()).toBe(12);
    clock.start(); now = 25000;
    expect(clock.seconds()).toBe(15);
  });
});
