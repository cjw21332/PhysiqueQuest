import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { prepareBenchmark, evaluateBenchmark, sha256 } from '../../scripts/qevd-research.mjs';
import { wholeMovementFrame } from './fixtures/rep-frames.mjs';
const source = await readFile(new URL('../../shared/repCounter.ts', import.meta.url), 'utf8');
const engine = {};
new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(engine);
// Original synthetic metadata and poses; no publisher records are embedded in this test.
function sample() {
  return { samples: [{ filepath: 'data/1234.mp4', metadata: { frame_rate: 10, total_frame_count: 36 },
    feedback_events: { detections: [{ label: 'Exercise transition', support: [1, 1], is_transition: true },
      { label: '5 reps!', support: [12, 15], is_transition: false }] } }] };
}
function fixture() {
  const manifest = prepareBenchmark(sample(), sha256('original synthetic metadata'));
  Object.assign(manifest.videos[0].segments[0], { reviewed: true, reviewer: 'fixture reviewer', groupId: 'fixture-person', kind: 'shoulderpress', side: 'left', expectedReps: 2 });
  let timestamp = 100;
  const frames = [];
  for (const angle of [180, 90, 180, 90, 180]) for (let i = 0; i < 7; i++) {
    frames.push(wholeMovementFrame('shoulderpress', angle, timestamp)); timestamp += 100;
  }
  const recording = { purpose: manifest.purpose, revision: manifest.revision, videoId: '1234',
    videoSha256: sha256('synthetic video'), modelSha256: sha256('synthetic model'), frames };
  return { manifest, recording, poses: new Map([['1234', recording]]) };
}
test('benchmark proposals convert one-based inclusive cue supports without inventing labels/counts', () => {
  const manifest = prepareBenchmark(sample(), sha256('fixture'));
  const segment = manifest.videos[0].segments[0];
  assert.equal(segment.startMs, 100); assert.equal(segment.endMs, 3600);
  assert.equal(segment.expectedReps, null); assert.equal(segment.kind, null); assert.equal(segment.reviewed, false);
  assert.equal(manifest.releaseCleared, false); assert.equal(manifest.audit.countCues, 1);
});
test('invalid or duplicated source metadata and temporal supports fail closed', () => {
  const input = sample(); input.samples.push(input.samples[0]);
  assert.throws(() => prepareBenchmark(input, sha256('fixture')), /duplicate/);
  const bad = sample(); bad.samples[0].feedback_events.detections[0].support = [0, 3];
  assert.throws(() => prepareBenchmark(bad, sha256('fixture')), /one-based/);
});
test('unreviewed benchmark has null metrics and cannot imply zero-error validation', () => {
  const { manifest, poses } = fixture(); manifest.videos[0].segments[0].reviewed = false;
  const report = evaluateBenchmark(manifest, poses, engine);
  assert.equal(report.scoredSegments, 0); assert.equal(report.pendingReview, 1);
  assert.equal(report.recognitionAccuracy, null); assert.equal(report.selectedRepMeanAbsoluteError, null);
});
test('reviewed motion replays the real counter and reports counts separately from recognition', () => {
  const { manifest, poses } = fixture();
  const report = evaluateBenchmark(manifest, poses, engine);
  assert.equal(report.scoredSegments, 1); assert.equal(report.results[0].selectedReps, 2);
  assert.equal(report.selectedRepMeanAbsoluteError, 0); assert.equal(report.recognitionAccuracy, 1);
  assert.equal(report.perKind.shoulderpress.precision, 1); assert.equal(report.perKind.shoulderpress.recall, 1);
  assert.equal(report.releaseCleared, false);
});
test('unsupported examples measure false accepts rather than pretending the detected family is ground truth', () => {
  const { manifest, poses } = fixture();
  Object.assign(manifest.videos[0].segments[0], { kind: null, side: null, expectedReps: null });
  const report = evaluateBenchmark(manifest, poses, engine);
  assert.equal(report.unsupportedSegments, 1); assert.equal(report.unsupportedFalseAccepts, 1);
  assert.equal(report.selectedRepMeanAbsoluteError, null); assert.equal(report.recognitionAccuracy, 0);
});
test('research evaluation rejects incomplete manual labels and pose provenance', () => {
  for (const change of [{ reviewer: '' }, { groupId: null }, { expectedReps: null }, { side: 'auto' }, { startMs: -1 }]) {
    const { manifest, poses } = fixture(); Object.assign(manifest.videos[0].segments[0], change);
    assert.throws(() => evaluateBenchmark(manifest, poses, engine), /Reviewed segments/);
  }
  const { manifest, poses, recording } = fixture(); recording.revision = 'other';
  assert.throws(() => evaluateBenchmark(manifest, poses, engine), /provenance/);
});
test('missing, reordered and truncated pose streams do not turn into successful zero counts', () => {
  const { manifest } = fixture();
  assert.equal(evaluateBenchmark(manifest, new Map(), engine).missingPoseVideos, 1);
  for (const mutate of [frames => frames.splice(0, 15), frames => frames.reverse(), frames => frames.splice(8, 10)]) {
    const { manifest: m, poses, recording } = fixture(); mutate(recording.frames);
    assert.throws(() => evaluateBenchmark(m, poses, engine), /pose stream|Pose stream/);
  }
});
test('each segment resets counting and overlapping reviewed boundaries are rejected', () => {
  const { manifest, poses, recording } = fixture();
  manifest.videos[0].frameCount = 72;
  const frames = recording.frames.map(frame => ({ ...frame, timestamp: frame.timestamp + 3600 }));
  recording.frames.push(...frames);
  manifest.videos[0].segments.push({ ...manifest.videos[0].segments[0], id: 'second', startMs: 3700, endMs: 7200 });
  assert.deepEqual(evaluateBenchmark(manifest, poses, engine).results.map(row => row.selectedReps), [2, 2]);
  manifest.videos[0].segments.pop();
  manifest.videos[0].segments.push({ ...manifest.videos[0].segments[0], id: 'second' });
  assert.throws(() => evaluateBenchmark(manifest, poses, engine), /Reviewed segments/);
});
test('training CLI explicitly rejects the held-out benchmark before any model output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pq-qevd-'));
  const input = join(directory, 'input.json');
  try {
    await writeFile(input, JSON.stringify({ purpose: 'held-out-evaluation-only', source: 'qevd benchmark', rows: [] }));
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/train-pose-classifier.mjs', import.meta.url)), input, join(directory, 'candidate.json')], { encoding: 'utf8' });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /must not be used for training/);
  } finally { await unlink(input); await rmdir(directory); }
});
