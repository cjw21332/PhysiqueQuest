import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

/** FEATURE_SPEC v1.1: 33 joints x (x, y, z, visibility), visibility kept raw. */
export const JOINTS = 33;
export const COORDS = 4;
export const FEATURES = JOINTS * COORDS;
export const FPS = 15;

export const MIN_SECONDS = 5;
export const MAX_SECONDS = 120;
export const MIN_FRAMES = MIN_SECONDS * FPS;
export const MAX_FRAMES = MAX_SECONDS * FPS;
export const MIN_DETECTION_RATE = 0.7;
const MAX_ABS_COORDINATE = 8;

export type DatasetPayload = {
  fps: number;
  timestampsMs: number[];
  /** N x 132, FEATURE_SPEC v1.1 normalised coordinates, raw visibility in column 4. */
  frames: number[][];
};

export type PayloadQuality = {
  frames: number;
  durationSeconds: number;
  medianFrameIntervalMs: number;
  detectionRate: number;
};

function isFiniteFrame(frame: number[]): boolean {
  return frame.every(value => Number.isFinite(value) && Math.abs(value) <= MAX_ABS_COORDINATE);
}

function frameDetected(frame: number[]): boolean {
  for (let i = 0; i < FEATURES; i += COORDS) {
    if (frame[i] !== 0 || frame[i + 1] !== 0 || frame[i + 2] !== 0) return true;
  }
  return false;
}

/**
 * Server-side quality gate. The client's own scores are not trusted: detection
 * is recomputed from the submitted coordinates, and a clip that would poison a
 * training set is rejected before it is stored.
 */
export function validatePayload(payload: DatasetPayload): PayloadQuality {
  const { frames, timestampsMs, fps } = payload;
  if (!Array.isArray(frames) || !Array.isArray(timestampsMs) || frames.length !== timestampsMs.length) {
    throw new BadRequestException({ code: 'DATASET_PAYLOAD_MISMATCH', message: 'frames and timestampsMs must have equal length' });
  }
  if (fps !== FPS) throw new BadRequestException({ code: 'DATASET_FPS', message: `Only ${FPS} fps keypoint sequences are accepted` });
  if (frames.length < MIN_FRAMES) throw new BadRequestException({ code: 'DATASET_TOO_SHORT', message: `Record at least ${MIN_SECONDS} seconds` });
  if (frames.length > MAX_FRAMES) throw new BadRequestException({ code: 'DATASET_TOO_LONG', message: `Keep contributions under ${MAX_SECONDS} seconds` });

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (!Array.isArray(frame) || frame.length !== FEATURES) {
      throw new BadRequestException({ code: 'DATASET_FRAME_SHAPE', message: `Frame ${i} must have ${FEATURES} values` });
    }
    if (!isFiniteFrame(frame)) throw new BadRequestException({ code: 'DATASET_FRAME_VALUES', message: `Frame ${i} has non-finite or implausible coordinates` });
    if (!Number.isFinite(timestampsMs[i])) throw new BadRequestException({ code: 'DATASET_TIMESTAMP', message: `Timestamp ${i} is not a number` });
    if (i && timestampsMs[i] <= timestampsMs[i - 1]) {
      throw new BadRequestException({ code: 'DATASET_TIMESTAMP_ORDER', message: 'Timestamps must strictly increase' });
    }
  }

  const intervals: number[] = [];
  for (let i = 1; i < timestampsMs.length; i++) intervals.push(timestampsMs[i] - timestampsMs[i - 1]);
  intervals.sort((a, b) => a - b);
  const medianFrameIntervalMs = intervals[Math.floor(intervals.length / 2)] ?? 0;
  if (medianFrameIntervalMs < 55 || medianFrameIntervalMs > 75) {
    throw new BadRequestException({ code: 'DATASET_FPS_DRIFT', message: 'Sequence is not sampled at 15 fps' });
  }

  const detectionRate = frames.filter(frameDetected).length / frames.length;
  if (detectionRate < MIN_DETECTION_RATE) {
    throw new BadRequestException({ code: 'DATASET_LOW_DETECTION', message: 'Too few frames contained a trackable body to be useful' });
  }

  return {
    frames: frames.length,
    durationSeconds: Math.round((timestampsMs[timestampsMs.length - 1] - timestampsMs[0]) / 100) / 10,
    medianFrameIntervalMs,
    detectionRate: Math.round(detectionRate * 10000) / 10000,
  };
}

/** Order-independent-of-JSON-formatting content hash used for duplicate detection. */
export function payloadHash(payload: DatasetPayload): string {
  const hash = createHash('sha256');
  hash.update(`${payload.fps}|${payload.frames.length}|`);
  for (let i = 0; i < payload.frames.length; i++) {
    hash.update(String(payload.timestampsMs[i]));
    hash.update('|');
    hash.update(payload.frames[i].map(v => (Number.isFinite(v) ? v.toFixed(5) : '0')).join(','));
    hash.update(';');
  }
  return hash.digest('hex');
}
