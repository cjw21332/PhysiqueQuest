import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canTrack, resolveTrackingConfig, unsupportedTrackingMessage } from '../../backend/src/pose-tracker/exercise-registry';

describe('exercise support versus camera access', () => {
  it.each([['v3xmPAR', 'Machine Seated Fly', 'chest_fly'], ['CHpahtl', 'Machine Seated Hip Abduction', 'hip_abduction']])('routes %s through its current local family', (exerciseId, name, pattern) => {
    const config = resolveTrackingConfig({ exerciseId, name });
    expect(config.nativePattern).toBe(pattern);
    expect(canTrack(config)).toBe(true);
    // Reproduce the old absent-family state, regardless of granted permission.
    const unmapped = { ...config, nativePattern: null, trackingMode: 'unavailable' as const, validationStatus: 'pending' as const };
    expect(canTrack(unmapped)).toBe(false);
    expect(unsupportedTrackingMessage).toBe('Tracking is not supported for this exercise. Manual logging is available.');
    expect(unsupportedTrackingMessage).not.toMatch(/camera|permission|access/i);
  });
  it('uses support wording and hides permission instructions when tracking is unavailable', () => {
    const screen = readFileSync('frontend/sections/Coach/PoseTrackerSession.tsx', 'utf8');
    expect(screen).toContain(': unsupportedTrackingMessage');
    expect(screen).toContain('{allowed && <p className="pose-setup-help">');
    expect(screen).not.toContain('Camera tracking is not ready for this exercise.');
  });
});
