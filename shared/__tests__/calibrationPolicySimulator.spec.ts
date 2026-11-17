import { describe, expect, it } from 'vitest';
import { CalibrationPolicySimulator } from './calibrationPolicySimulator';

describe('experimental deferred calibration model', () => {
  it('freezes active thresholds and applies a candidate only after completion', () => {
    const s = new CalibrationPolicySimulator({ start: 160, peak: 80 }, 30);
    s.update(160); s.update(130); expect(s.state).toBe('moving');
    expect(s.propose({ start: 145, peak: 100 })).toBe(true);
    expect(s.active).toEqual({ start: 160, peak: 80 }); expect(s.frozen).toEqual(s.active);
    s.update(100); expect(s.state).toBe('moving');
    s.update(80); s.update(160);
    expect(s.outcomes).toEqual(['completed_full']); expect(s.active).toEqual({ start: 145, peak: 100 });
    s.update(145); expect(s.outcomes).toHaveLength(1);
  });
  it('rejects an inadequate candidate and cannot make a false completion from its threshold', () => {
    const s = new CalibrationPolicySimulator({ start: 160, peak: 80 }, 30);
    s.update(130); expect(s.propose({ start: 160, peak: 150 })).toBe(false);
    s.update(120); s.update(160); expect(s.outcomes).toHaveLength(0);
  });
  it('discards interrupted movement and does not count recovery as a rep', () => {
    const s = new CalibrationPolicySimulator({ start: 160, peak: 80 }, 30);
    s.update(130); s.propose({ start: 145, peak: 100 }); s.update(null); s.update(100); s.update(160);
    expect(s.outcomes).toEqual(['interrupted']); expect(s.active).toEqual({ start: 160, peak: 80 }); expect(s.pending).toBeNull();
  });
});
