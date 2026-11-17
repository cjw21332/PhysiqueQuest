import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FEATURES,
  assessQuality,
  buildContribution,
  createContributionRecorder,
  createDatasetApi,
  normaliseFrame,
  placementGuidance,
  resampleTo15fps,
} from './datasetContribution.mjs';

function landmarks({ hip = { x: 0.5, y: 0.6 }, shoulder = { x: 0.5, y: 0.4 }, wobble = 0 } = {}) {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
  points[23] = { x: hip.x - 0.05, y: hip.y, z: 0, visibility: 0.95 };
  points[24] = { x: hip.x + 0.05, y: hip.y, z: 0, visibility: 0.95 };
  points[11] = { x: shoulder.x - 0.08, y: shoulder.y, z: 0, visibility: 0.95 };
  points[12] = { x: shoulder.x + 0.08, y: shoulder.y, z: 0, visibility: 0.95 };
  points[27] = { x: 0.45 + wobble, y: 0.8, z: 0, visibility: 0.9 };
  return points;
}

function samples(count = 150) {
  return Array.from({ length: count }, (_, index) => ({
    timestampMs: index * (1000 / 15),
    landmarks: landmarks({ wobble: Math.sin(index / 6) * 0.05 }),
  }));
}

test('normalises to the mid-hip with unit torso and keeps raw visibility', () => {
  const frame = normaliseFrame(landmarks());
  assert.equal(frame.length, FEATURES);
  // Hip midpoint maps near the origin and the visibility column stays 0..1.
  const hipY = (frame[23 * 4 + 1] + frame[24 * 4 + 1]) / 2;
  assert.ok(Math.abs(hipY) < 1e-6);
  assert.equal(frame[23 * 4 + 3], 0.95);
  const leftKnee = frame[27 * 4 + 1];
  assert.ok(leftKnee > 0.5, 'knee sits below the hips');
});

test('returns null for a degenerate torso instead of emitting NaN', () => {
  const collapsed = landmarks();
  collapsed[11] = { x: 0.5, y: 0.6, z: 0, visibility: 0.9 };
  collapsed[12] = { x: 0.5, y: 0.6, z: 0, visibility: 0.9 };
  assert.equal(normaliseFrame(collapsed), null);
});

test('resamples onto a uniform 15 fps grid covering the recording', () => {
  const { timestampsMs, frames } = resampleTo15fps(samples(150));
  const duration = (150 - 1) / 15;
  assert.equal(frames.length, Math.round(duration * 15));
  assert.equal(timestampsMs.length, frames.length);
  assert.ok(timestampsMs[0] === 0);
  const gaps = timestampsMs.slice(1).map((value, index) => value - timestampsMs[index]);
  assert.ok(gaps.every(gap => Math.abs(gap - gaps[0]) < 1e-6));
  assert.ok(Math.abs(gaps[0] - 1000 / 15) < 1);
});

test('accepts a clean contribution and reports its quality', () => {
  const built = buildContribution({
    samples: samples(150),
    exerciseId: 'squat',
    exerciseName: 'Bodyweight squat',
    pattern: 'squat',
    cameraPlacement: 'diagonal',
    cameraFacing: 'front',
    orientation: 'portrait',
    appVersion: '5.1.0',
  });
  assert.equal(built.acceptedLocally, true, built.reason);
  assert.ok(built.quality.frames >= 75);
  assert.equal(built.quality.detectionRate, 1);
  assert.equal(built.submission.frames[0].length, FEATURES);
});

test('rejects short recordings, missing bodies and missing exercise labels', () => {
  const short = buildContribution({
    samples: samples(40),
    exerciseId: 'squat',
    exerciseName: 'Squat',
    pattern: 'squat',
    cameraPlacement: 'front',
    cameraFacing: 'front',
    orientation: 'portrait',
  });
  assert.equal(short.acceptedLocally, false);
  assert.match(short.reason, /at least/);

  const blank = samples(150).map(sample => ({ timestampMs: sample.timestampMs, landmarks: null }));
  const missing = buildContribution({
    samples: blank,
    exerciseId: 'squat',
    exerciseName: 'Squat',
    pattern: 'squat',
    cameraPlacement: 'front',
    cameraFacing: 'front',
    orientation: 'portrait',
  });
  assert.equal(missing.acceptedLocally, false);
  assert.match(missing.reason, /not tracked/);

  assert.throws(
    () =>
      buildContribution({
        samples: samples(150),
        exerciseId: '',
        exerciseName: '',
        pattern: '',
        cameraPlacement: 'front',
        cameraFacing: 'front',
        orientation: 'portrait',
      }),
    /Choose the exercise/,
  );
});

test('quality gate rejects malformed payloads', () => {
  assert.equal(assessQuality({ fps: 30, timestampsMs: [], frames: [] }).ok, false);
  const { timestampsMs, frames } = resampleTo15fps(samples(150));
  const broken = { fps: 15, timestampsMs, frames: frames.map((frame, index) => (index === 3 ? frame.map(v => v + 99) : frame)) };
  assert.match(assessQuality(broken).reason, /not a usable pose/);
});

test('recorder is bounded and only holds what was explicitly added', () => {
  const recorder = createContributionRecorder(3);
  assert.equal(recorder.add(landmarks(), 0), true);
  assert.equal(recorder.add(landmarks(), 67), true);
  assert.equal(recorder.add(landmarks(), 133), true);
  assert.equal(recorder.add(landmarks(), 200), false);
  assert.equal(recorder.size(), 3);
  recorder.clear();
  assert.equal(recorder.size(), 0);
});

test('api client requires the server consent document and never invents one', async () => {
  const calls = [];
  const api = createDatasetApi({
    baseUrl: 'https://example.test/api',
    token: 'token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ version: 'v1', textHash: 'abc', state: { contributable: false } }) };
    },
  });
  const document = await api.consentState();
  assert.equal(document.version, 'v1');
  assert.equal(calls[0].url, 'https://example.test/api/dataset/consent');
  await api.acceptConsent(document);
  assert.equal(calls[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].init.body), { version: 'v1', textHash: 'abc', accepted: true });
  assert.equal(placementGuidance('side').includes('side-on'), true);
});
