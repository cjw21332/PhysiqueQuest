import { describe, expect, it, vi } from 'vitest';
import { analyzeSequence, patternSpec, type Landmark, type PatternId, type PoseFrame } from '../exerciseEngine';
import { analyzeVideoLandmarks, withTempVideoCleanup, type VideoLandmarkFrame } from '../videoAnalysisPipeline';

const blank = (): Landmark[] => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));

function setAngle(landmarks: Landmark[], indices: readonly [number, number, number], angle: number, bx = 0.5, by = 0.5) {
  const [a, b, c] = indices;
  const length = 0.12;
  landmarks[a] = { x: bx, y: by - length, z: 0, visibility: 1 };
  landmarks[b] = { x: bx, y: by, z: 0, visibility: 1 };
  const radians = (-90 + angle) * Math.PI / 180;
  landmarks[c] = { x: bx + length * Math.cos(radians), y: by + length * Math.sin(radians), z: 0, visibility: 1 };
}

function poseFrame(pattern: PatternId, angle: number, timestamp: number): PoseFrame {
  const landmarks = blank();
  const spec = patternSpec(pattern);
  setAngle(landmarks, spec.joints.left, angle);
  setAngle(landmarks, spec.joints.right, angle, 0.45, 0.5);
  return { landmarks, timestamp, aspect: 1 };
}

function cycle(pattern: PatternId, from: number, to: number, start: number): PoseFrame[] {
  const values = [from, (from + to) / 2, to, to, (from + to) / 2, from];
  return values.map((angle, index) => poseFrame(pattern, angle, start + index * 150));
}

async function* stream(frames: VideoLandmarkFrame[]) {
  for (const frame of frames) {
    await Promise.resolve();
    yield frame;
  }
}

const asVideoFrames = (frames: PoseFrame[]): VideoLandmarkFrame[] => frames.map(frame => ({
  timestampMs: frame.timestamp,
  landmarks: frame.landmarks,
  imageWidth: 720,
  imageHeight: 1280,
}));

describe('local video pipeline', () => {
  it('produces the same repetition count as the shared live engine', async () => {
    const frames = [
      ...cycle('squat', 172, 95, 0),
      ...cycle('squat', 172, 95, 900),
      ...cycle('squat', 172, 95, 1800),
    ];
    const live = analyzeSequence('squat', frames);
    const video = await analyzeVideoLandmarks(stream(asVideoFrames(frames)), 'squat');
    expect(live.reps).toBe(3);
    expect(video.snapshot.reps).toBe(live.reps);
    expect(video.frames).toBe(frames.length);
  });

  it('skips frames without a usable body or image geometry', async () => {
    const valid = asVideoFrames(cycle('squat', 172, 95, 0));
    const frames: VideoLandmarkFrame[] = [
      { timestampMs: 0, landmarks: blank().slice(0, 10), imageWidth: 720, imageHeight: 1280 },
      { timestampMs: 1, landmarks: blank(), imageWidth: 0, imageHeight: 0 },
      ...valid,
    ];
    const result = await analyzeVideoLandmarks(stream(frames), 'squat');
    expect(result.frames).toBe(valid.length);
    expect(result.snapshot.reps).toBe(1);
  });

  it('stops immediately when cancelled and never returns a summary', async () => {
    const controller = new AbortController();
    const frames = asVideoFrames([...cycle('squat', 172, 95, 0), ...cycle('squat', 172, 95, 900)]);
    let seen = 0;
    await expect(analyzeVideoLandmarks(stream(frames), 'squat', {
      signal: controller.signal,
      onProgress: () => { seen += 1; if (seen === 2) controller.abort(); },
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(seen).toBe(2);
  });

  it('removes the temporary video copy even when analysis throws', async () => {
    const remove = vi.fn(async () => undefined);
    await expect(withTempVideoCleanup('file:///cache/picked.mp4', async () => {
      throw new Error('decoder failed');
    }, remove)).rejects.toThrow('decoder failed');
    expect(remove).toHaveBeenCalledWith('file:///cache/picked.mp4');
  });

  it('does not attempt cleanup when no local file was copied', async () => {
    const remove = vi.fn(async () => undefined);
    await expect(withTempVideoCleanup(undefined, async () => 'ok', remove)).resolves.toBe('ok');
    expect(remove).not.toHaveBeenCalled();
  });
});
