import { createHash } from 'node:crypto';

export const QEVD_SOURCE = 'https://huggingface.co/datasets/Voxel51/qualcomm-exercise-video-dataset-benchmark';
export const QEVD_REVISION = '0120718af698ba7e2558aa4417bdd916b20080bb';
export const QEVD_LICENSE = 'https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/Dataset-Research-License-Feb-25-2025.pdf';
export const sha256 = value => createHash('sha256').update(value).digest('hex');

/** Transition cues propose review windows; they do not establish action boundaries or rep totals. */
export function prepareBenchmark(input, inputHash) {
  if (!Array.isArray(input.samples) || !input.samples.length) throw new Error('Expected FiftyOne video samples');
  const seen = new Set();
  let events = 0, transitions = 0, countCues = 0, durationSeconds = 0;
  const videos = input.samples.map(sample => {
    const videoId = sample.video_id ?? sample.filepath?.match(/^data\/(\d+)\.mp4$/)?.[1];
    const meta = sample.metadata;
    if (!/^\d+$/.test(videoId) || seen.has(videoId) || sample.filepath !== `data/${videoId}.mp4` ||
        !meta || !Number.isFinite(meta.frame_rate) || meta.frame_rate <= 0 ||
        !Number.isInteger(meta.total_frame_count) || meta.total_frame_count <= 0) throw new Error('Invalid/duplicate video metadata');
    seen.add(videoId);
    const detections = sample.feedback_events?.detections;
    if (!Array.isArray(detections)) throw new Error('Missing temporal feedback');
    for (const item of detections) {
      if (typeof item.label !== 'string' || !Array.isArray(item.support) || item.support.length !== 2 ||
          !item.support.every(Number.isInteger) || item.support[0] < 1 || item.support[1] < item.support[0] || item.support[1] > meta.total_frame_count) throw new Error('Invalid one-based inclusive temporal support');
    }
    const cues = detections.filter(item => item.is_transition === true).sort((a, b) => a.support[0] - b.support[0]);
    if (cues.some((item, i) => i && item.support[0] <= cues[i - 1].support[1])) throw new Error('Overlapping transition cues');
    events += detections.length; transitions += cues.length;
    countCues += detections.filter(item => !item.is_transition && /^(?:\d+|.*\b\d+\s+reps?[!.]?)$/i.test(item.label.trim())).length;
    durationSeconds += meta.total_frame_count / meta.frame_rate;
    return { videoId, filepath: sample.filepath, fps: meta.frame_rate, frameCount: meta.total_frame_count,
      // FiftyOne support is one-based inclusive. Convert to zero-based, half-open milliseconds.
      segments: cues.map((cue, index) => ({ id: `${videoId}-${index + 1}`, transitionCue: cue.label,
        startMs: cue.support[1] / meta.frame_rate * 1000,
        endMs: (cues[index + 1] ? cues[index + 1].support[0] - 1 : meta.total_frame_count) / meta.frame_rate * 1000,
        reviewed: false, reviewer: null, groupId: null, kind: null, side: null, expectedReps: null,
        notes: 'Proposed window only. Inspect actual motion onset/end, transitions, counting convention and unsupported exercises.' })) };
  });
  return { version: 1, purpose: 'held-out-evaluation-only', source: QEVD_SOURCE, revision: QEVD_REVISION,
    license: QEVD_LICENSE, samplesSha256: inputHash, releaseCleared: false, videos,
    audit: { videos: videos.length, durationSeconds, feedbackEvents: events, transitionCues: transitions, countCues,
      scoredSegments: 0, note: 'Coaching count cues are not complete, verified repetition ground truth.' } };
}

export function assertBenchmark(manifest) {
  if (manifest?.version !== 1 || manifest.purpose !== 'held-out-evaluation-only' || manifest.source !== QEVD_SOURCE ||
      manifest.revision !== QEVD_REVISION || manifest.releaseCleared !== false || !/^[a-f0-9]{64}$/.test(manifest.samplesSha256) ||
      !Array.isArray(manifest.videos)) throw new Error('Expected pinned research-only benchmark manifest');
}

export function evaluateBenchmark(manifest, poses, engine) {
  assertBenchmark(manifest);
  const results = [], ids = new Set(), videoIds = new Set();
  let pending = 0, missingPoseVideos = 0;
  for (const video of manifest.videos) {
    if (!/^\d+$/.test(video.videoId) || videoIds.has(video.videoId) || !Array.isArray(video.segments) ||
        !Number.isFinite(video.fps) || video.fps <= 0 || !Number.isInteger(video.frameCount) || video.frameCount <= 0) throw new Error('Invalid manifest video');
    videoIds.add(video.videoId);
    const reviewed = video.segments.filter(segment => segment.reviewed === true);
    pending += video.segments.length - reviewed.length;
    if (!reviewed.length) continue;
    const recording = poses.get(video.videoId);
    if (!recording) { missingPoseVideos++; continue; }
    if (recording.purpose !== manifest.purpose || recording.revision !== manifest.revision || recording.videoId !== video.videoId ||
        !/^[a-f0-9]{64}$/.test(recording.videoSha256) || !/^[a-f0-9]{64}$/.test(recording.modelSha256) ||
        !Array.isArray(recording.frames)) throw new Error('Invalid pose recording provenance');
    let previous = -Infinity;
    for (const frame of recording.frames) {
      if (!Number.isFinite(frame.timestamp) || frame.timestamp < 0 || frame.timestamp <= previous ||
          !Number.isFinite(frame.aspect) || frame.aspect <= 0 || !Array.isArray(frame.joints) || ![0, 33].includes(frame.joints.length)) throw new Error('Invalid full-frame pose stream');
      previous = frame.timestamp;
    }
    let lastEnd = -Infinity;
    for (const segment of reviewed) {
      if (!segment.id || ids.has(segment.id) || !segment.reviewer?.trim() || !segment.groupId?.trim() ||
          !Number.isFinite(segment.startMs) || !Number.isFinite(segment.endMs) || segment.startMs < lastEnd || segment.startMs < 0 || segment.endMs <= segment.startMs ||
          segment.endMs > video.frameCount / video.fps * 1000 + 1 ||
          (segment.kind !== null && (!engine.trackingKinds.includes(segment.kind) || !['left', 'right'].includes(segment.side))) ||
          (segment.kind !== null && (!Number.isInteger(segment.expectedReps) || segment.expectedReps < 0))) throw new Error('Reviewed segments require unique IDs, reviewer/group, disjoint boundaries and verified counts/side for supported movements');
      ids.add(segment.id); lastEnd = segment.endMs;
      const frames = recording.frames.filter(frame => frame.timestamp >= segment.startMs && frame.timestamp < segment.endMs);
      // Empty/gapped streams must not silently become zero-rep successes.
      if (frames.length < 2 || frames[0].timestamp - segment.startMs > 600 || segment.endMs - frames.at(-1).timestamp > 600 ||
          frames.some((frame, i) => i && frame.timestamp - frames[i - 1].timestamp > 600)) throw new Error('Pose stream does not cover a reviewed segment');
      const identifier = engine.createExerciseIdentifier();
      const counter = segment.kind ? engine.createRepCounter(segment.kind) : null;
      for (const frame of frames) {
        identifier.update(frame);
        if (counter) counter.update(engine.selectTrackingFrame(frame, segment.kind, segment.side));
      }
      const automatic = identifier.result();
      const predicted = automatic?.kind ?? null, reps = counter?.snapshot().reps ?? null;
      results.push({ id: segment.id, videoId: video.videoId, groupId: segment.groupId, expectedKind: segment.kind,
        predictedKind: predicted, recognizedCorrectly: predicted === segment.kind,
        expectedReps: segment.kind ? segment.expectedReps : null, selectedReps: reps,
        absoluteRepError: counter ? Math.abs(reps - segment.expectedReps) : null,
        automaticReps: automatic?.reps ?? null,
        poseFrames: frames.length, missingPoseFrames: frames.filter(frame => !frame.joints.length).length,
        videoSha256: recording.videoSha256, modelSha256: recording.modelSha256 });
    }
  }
  const counted = results.filter(row => row.absoluteRepError !== null);
  const unknown = results.filter(row => row.expectedKind === null);
  const confusion = {};
  for (const row of results) {
    const expected = row.expectedKind ?? 'unsupported', predicted = row.predictedKind ?? 'rejected';
    const line = confusion[expected] ?? (confusion[expected] = {}); line[predicted] = (line[predicted] ?? 0) + 1;
  }
  const perKind = {};
  for (const kind of new Set(results.flatMap(row => [row.expectedKind, row.predictedKind]).filter(Boolean))) {
    const expected = results.filter(row => row.expectedKind === kind);
    const predicted = results.filter(row => row.predictedKind === kind);
    const matched = expected.filter(row => row.predictedKind === kind).length;
    perKind[kind] = { segments: expected.length, precision: predicted.length ? matched / predicted.length : null,
      recall: expected.length ? matched / expected.length : null,
      selectedRepMeanAbsoluteError: expected.length ? expected.reduce((sum, row) => sum + row.absoluteRepError, 0) / expected.length : null,
      selectedExactCountRate: expected.length ? expected.filter(row => row.absoluteRepError === 0).length / expected.length : null };
  }
  return { purpose: manifest.purpose, releaseCleared: false, revision: manifest.revision, samplesSha256: manifest.samplesSha256,
    counterVersion: engine.REP_COUNTER_VERSION, identifierVersion: engine.IDENTIFIER_VERSION,
    scoredSegments: results.length, pendingReview: pending, missingPoseVideos,
    recognitionAccuracy: results.length ? results.filter(row => row.recognizedCorrectly).length / results.length : null,
    selectedRepMeanAbsoluteError: counted.length ? counted.reduce((sum, row) => sum + row.absoluteRepError, 0) / counted.length : null,
    unsupportedFalseAccepts: unknown.filter(row => row.predictedKind !== null).length, unsupportedSegments: unknown.length,
    evaluatedGroups: new Set(results.map(row => row.groupId)).size, perKind, confusion, results,
    note: 'Internal research only. Fixed heuristic baseline; no benchmark training/tuning or release clearance. Segment-level recognition differs from multi-exercise whole-session detection.' };
}
