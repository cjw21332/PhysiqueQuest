import { describe, expect, it } from 'vitest';
import { parseNativePoseSummary } from './poseSessionSummary';

describe('native pose session summary', () => {
  const summary = { completeReps: 10, partialReps: 2, durationSeconds: 30, holdMs: null };
  it('keeps the existing summary contract and accepts bounded issue counts', () => {
    expect(parseNativePoseSummary(summary)).toEqual(summary);
    expect(parseNativePoseSummary({ ...summary, issues: [{ id: 'body_line', count: 2 }] })).toEqual({ ...summary, issues: [{ id: 'body_line', count: 2 }] });
  });
  it('rejects unknown or malformed feedback', () => {
    expect(parseNativePoseSummary({ ...summary, issues: [{ id: 'unknown', count: 1 }] })).toBeNull();
    expect(parseNativePoseSummary({ ...summary, issues: [{ id: 'depth', count: -1 }] })).toBeNull();
  });
});
