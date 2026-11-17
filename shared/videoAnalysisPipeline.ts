import {
  createExerciseCounter,
  type EngineSnapshot,
  type ExerciseConfigOverride,
  type Landmark,
  type PatternId,
} from './exerciseEngine';

export type VideoLandmarkFrame = {
  timestampMs: number;
  landmarks: readonly Landmark[];
  imageWidth: number;
  imageHeight: number;
};

export type VideoAnalysisResult = { snapshot: EngineSnapshot; frames: number };

const cancelled = () => {
  const error = new Error('Video analysis was cancelled');
  error.name = 'AbortError';
  return error;
};

/**
 * Feed locally decoded video frames through the same exercise engine used live.
 * Frames without a usable body are skipped; cancellation is checked between frames.
 */
export async function analyzeVideoLandmarks(
  frames: AsyncIterable<VideoLandmarkFrame>,
  patternId: PatternId,
  options: { signal?: AbortSignal; onProgress?: (completedFrames: number) => void; override?: ExerciseConfigOverride } = {},
): Promise<VideoAnalysisResult> {
  if (options.signal?.aborted) throw cancelled();
  const counter = createExerciseCounter(patternId, { override: options.override });
  let completed = 0;
  for await (const frame of frames) {
    if (options.signal?.aborted) throw cancelled();
    if (!Number.isFinite(frame.timestampMs) || frame.landmarks.length < 29) continue;
    if (!(frame.imageWidth > 0) || !(frame.imageHeight > 0)) continue;
    counter.update({
      landmarks: frame.landmarks,
      timestamp: frame.timestampMs,
      aspect: frame.imageWidth / frame.imageHeight,
    });
    completed += 1;
    options.onProgress?.(completed);
  }
  if (options.signal?.aborted) throw cancelled();
  counter.finish();
  return { snapshot: counter.snapshot(), frames: completed };
}

/** Always remove the app's local copy of a picked video, even when analysis fails. */
export async function withTempVideoCleanup<T>(
  uri: string | undefined,
  run: () => Promise<T>,
  remove: (uri: string) => Promise<unknown>,
): Promise<T> {
  try {
    return await run();
  } finally {
    if (uri) await remove(uri).catch(() => undefined);
  }
}
