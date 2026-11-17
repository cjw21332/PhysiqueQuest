/**
 * Opt-in contribution of PoseTracker keypoints to model development.
 *
 * This module is deliberately independent of the live session: nothing is
 * recorded or uploaded unless the caller starts a contribution and the account
 * has accepted the server's contribution consent (which is separate from
 * camera permission). See backend/src/dataset for the server-side gate.
 *
 * Coordinates follow FEATURE_SPEC v1.1: mid-hip centred, unit torso, 15 fps,
 * visibility kept raw. Payloads carry no video, images, names or account ids.
 */
export const FEATURE_VERSION = 'feature-spec-1.1';
export const FPS = 15;
export const JOINTS = 33;
export const COORDS = 4;
export const FEATURES = JOINTS * COORDS;
export const MIN_FRAMES = 75;
export const MAX_FRAMES = 1800;
export const MIN_DETECTION_RATE = 0.7;

const MAX_ABS_COORDINATE = 8;
const PAD_FACTOR = 1.5;
const OFFSET = (PAD_FACTOR - 1) / 2;

export const CAMERA_PLACEMENTS = [
  { id: 'front', label: 'Front', guidance: 'Phone at hip height, 2–3 m away, facing you.' },
  { id: 'side', label: 'Side', guidance: 'Phone side-on, 2–3 m away, movement across the frame.' },
  { id: 'diagonal', label: 'Diagonal', guidance: 'Phone 45° to your front, 2–3 m away.' },
  { id: 'other', label: 'Other', guidance: 'Describe the placement in the notes before contributing.' },
];

export function placementGuidance(id) {
  return CAMERA_PLACEMENTS.find(item => item.id === id)?.guidance ?? '';
}

/** Un-pad MediaPipe's padded-image coordinates back to the camera frame. */
export function unpad(landmark) {
  return {
    x: landmark.x * PAD_FACTOR - OFFSET,
    y: landmark.y * PAD_FACTOR - OFFSET,
    z: landmark.z * PAD_FACTOR,
    visibility: landmark.visibility,
  };
}

/**
 * Normalise one frame. Returns a 132-length array, or null when the torso is
 * degenerate (same rule as the Python extractor).
 */
export function normaliseFrame(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < JOINTS) return null;
  const points = landmarks.map(unpad);
  const midHip = {
    x: (points[23].x + points[24].x) / 2,
    y: (points[23].y + points[24].y) / 2,
  };
  const midShoulder = {
    x: (points[11].x + points[12].x) / 2,
    y: (points[11].y + points[12].y) / 2,
  };
  const torso = Math.hypot(midHip.x - midShoulder.x, midHip.y - midShoulder.y);
  if (!Number.isFinite(torso) || torso < 1e-6) return null;

  const frame = new Array(FEATURES).fill(0);
  for (let joint = 0; joint < JOINTS; joint++) {
    const point = points[joint];
    const base = joint * COORDS;
    frame[base] = (point.x - midHip.x) / torso;
    frame[base + 1] = (point.y - midHip.y) / torso;
    frame[base + 2] = point.z / torso;
    frame[base + 3] = Number.isFinite(point.visibility) ? point.visibility : 0;
  }
  return frame;
}

function interpolate(times, values, target) {
  let low = 0;
  let high = times.length - 1;
  while (low < high - 1) {
    const middle = (low + high) >> 1;
    if (times[middle] <= target) low = middle;
    else high = middle;
  }
  const span = times[high] - times[low];
  if (!(span > 0)) return values[low];
  const ratio = Math.min(1, Math.max(0, (target - times[low]) / span));
  return values[low] + (values[high] - values[low]) * ratio;
}

/**
 * Resample sampled frames onto the FEATURE_SPEC 15 fps grid.
 * samples: [{ timestampMs, landmarks: array|null }]
 */
export function resampleTo15fps(samples) {
  const usable = samples.filter(sample => Number.isFinite(sample?.timestampMs));
  if (usable.length < 2) return { timestampsMs: [], frames: [] };
  usable.sort((a, b) => a.timestampMs - b.timestampMs);
  if (usable[usable.length - 1].timestampMs <= usable[0].timestampMs) return { timestampsMs: [], frames: [] };

  const times = usable.map(sample => sample.timestampMs);
  const zeros = new Array(FEATURES).fill(0);
  const values = usable.map(sample => normaliseFrame(sample.landmarks) ?? zeros);

  const durationSeconds = (times[times.length - 1] - times[0]) / 1000;
  const count = Math.max(2, Math.round(durationSeconds * FPS));
  const timestampsMs = Array.from({ length: count }, (_, index) =>
    times[0] + ((times[times.length - 1] - times[0]) * index) / (count - 1),
  );
  const frames = timestampsMs.map(timestamp =>
    values[0].map((_, feature) =>
      interpolate(times, values.map(frame => frame[feature]), timestamp),
    ),
  );
  return { timestampsMs, frames };
}

function frameDetected(frame) {
  for (let index = 0; index < FEATURES; index += COORDS) {
    if (frame[index] !== 0 || frame[index + 1] !== 0 || frame[index + 2] !== 0) return true;
  }
  return false;
}

/** Mirrors the server quality gate so a user learns about a bad clip before upload. */
export function assessQuality(payload) {
  const { frames, timestampsMs, fps } = payload;
  if (fps !== FPS) return { ok: false, reason: `Only ${FPS} fps contributions are accepted.` };
  if (!frames?.length || frames.length !== timestampsMs?.length) return { ok: false, reason: 'The recording is incomplete.' };
  if (frames.length < MIN_FRAMES) return { ok: false, reason: `Record at least ${MIN_FRAMES / FPS} seconds.` };
  if (frames.length > MAX_FRAMES) return { ok: false, reason: `Keep the recording under ${MAX_FRAMES / FPS} seconds.` };
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index];
    if (frame.length !== FEATURES || frame.some(value => !Number.isFinite(value) || Math.abs(value) > MAX_ABS_COORDINATE)) {
      return { ok: false, reason: `Frame ${index} is not a usable pose.` };
    }
    if (index && timestampsMs[index] <= timestampsMs[index - 1]) {
      return { ok: false, reason: 'The recording timestamps are out of order.' };
    }
  }
  const intervals = timestampsMs.slice(1).map((value, index) => value - timestampsMs[index]).sort((a, b) => a - b);
  const medianFrameIntervalMs = intervals[Math.floor(intervals.length / 2)];
  if (medianFrameIntervalMs < 55 || medianFrameIntervalMs > 75) {
    return { ok: false, reason: 'The recording is not sampled at 15 fps.' };
  }
  const detectionRate = frames.filter(frameDetected).length / frames.length;
  if (detectionRate < MIN_DETECTION_RATE) {
    return { ok: false, reason: 'The body was not tracked for enough of the recording. Improve lighting and framing.', detectionRate };
  }
  return {
    ok: true,
    quality: {
      frames: frames.length,
      durationSeconds: Math.round((timestampsMs[timestampsMs.length - 1] - timestampsMs[0]) / 100) / 10,
      medianFrameIntervalMs,
      detectionRate: Math.round(detectionRate * 10000) / 10000,
    },
  };
}

/**
 * Build a submission from raw sampled frames. Rep boundaries are expressed as
 * frame indices in the resampled sequence.
 */
export function buildContribution({
  samples,
  exerciseId,
  exerciseName,
  pattern,
  cameraPlacement,
  cameraFacing,
  orientation,
  appVersion,
  declaredReps,
}) {
  if (!exerciseId || !exerciseName || !pattern) throw new Error('Choose the exercise before recording.');
  if (!CAMERA_PLACEMENTS.some(item => item.id === cameraPlacement)) throw new Error('Choose a camera placement.');
  const { timestampsMs, frames } = resampleTo15fps(samples);
  const payload = { fps: FPS, timestampsMs, frames };
  const assessment = assessQuality(payload);
  return {
    acceptedLocally: assessment.ok,
    reason: assessment.reason ?? null,
    quality: assessment.quality ?? null,
    submission: {
      exerciseId,
      exerciseName,
      pattern,
      cameraPlacement,
      cameraFacing: cameraFacing === 'back' ? 'back' : 'front',
      orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
      appVersion: appVersion || 'unknown',
      declaredReps,
      features: FEATURE_VERSION,
      ...payload,
    },
  };
}

/** Consent text is fetched from the server so the client cannot drift from it. */
export function createDatasetApi({ baseUrl, token, fetchImpl = globalThis.fetch }) {
  const call = async (path, init = {}) => {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/dataset${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message || `Dataset request failed (${response.status})`);
    return body;
  };
  return {
    consentState: () => call('/consent'),
    acceptConsent: document =>
      call('/consent', { method: 'POST', body: JSON.stringify({ version: document.version, textHash: document.textHash, accepted: true }) }),
    withdrawConsent: () => call('/consent', { method: 'DELETE' }),
    submit: submission => call('/clips', { method: 'POST', body: JSON.stringify(submission) }),
    list: () => call('/clips'),
    remove: id => call(`/clips/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
}

/** Buffers frames during an explicit contribution recording only. */
export function createContributionRecorder(limitFrames = MAX_FRAMES + 30) {
  const samples = [];
  return {
    add(landmarks, timestampMs) {
      if (samples.length >= limitFrames) return false;
      samples.push({ timestampMs, landmarks });
      return true;
    },
    size: () => samples.length,
    clear: () => samples.splice(0, samples.length),
    samples: () => samples.slice(),
  };
}
