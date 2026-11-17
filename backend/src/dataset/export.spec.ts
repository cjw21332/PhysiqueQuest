import { describe, expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';
import { Types } from 'mongoose';
// @ts-expect-error plain ESM script without type declarations
import { buildExport } from '../../scripts/export-dataset.mjs';

const clipId = new Types.ObjectId();
const payload = { payloadVersion: 'feature-spec-1.1', fps: 15, timestampsMs: [0, 66.7], frames: [[0, 0, 0, 0.9], [1, 1, 1, 0.8]] };

function clip(overrides = {}) {
  return {
    _id: clipId,
    userId: new Types.ObjectId(),
    subjectPseudonym: 'study-code-abcdef123456',
    exerciseId: 'squat',
    exerciseName: 'Bodyweight squat',
    pattern: 'squat',
    cameraPlacement: 'diagonal',
    cameraFacing: 'back',
    orientation: 'portrait',
    durationSeconds: 32,
    appVersion: '5.1.0',
    consentVersion: '2026-11-16.v1',
    annotation: {
      exerciseId: 'squat',
      pattern: 'squat',
      correctness: 'correct',
      repBoundaries: [{ startFrame: 2, endFrame: 20 }],
      phases: [{ name: 'descent', startFrame: 2, endFrame: 10 }],
      formDeviations: [],
      keypointQuality: 'good',
    },
    ...overrides,
  };
}

describe('dataset export', () => {
  it('writes pseudonymous clips with their payload and no identity fields', () => {
    const { manifest, files } = buildExport(
      [clip()],
      [{ clipId, data: gzipSync(Buffer.from(JSON.stringify(payload))) }],
      { version: 'test-v1', datasetLicence: 'research use' },
    );
    expect(manifest.clips).toBe(1);
    expect(manifest.subjects).toEqual(['study-code-abcdef123456']);
    expect(files[0].relative.split('\\').join('/')).toBe(`squat/${clipId}.json`);
    expect(files[0].body.payload.frames).toHaveLength(2);
    expect(JSON.stringify(files[0].body)).not.toContain('userId');
    expect(files[0].body.annotation.keypointQuality).toBe('good');
  });

  it('skips clips whose payload is missing instead of writing a broken entry', () => {
    const { manifest } = buildExport([clip()], [], { version: 'test-v1', datasetLicence: 'research use' });
    expect(manifest.clips).toBe(0);
  });
});
