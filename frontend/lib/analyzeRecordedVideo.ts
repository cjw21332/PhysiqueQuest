import { createExerciseIdentifier, createRepCounter, trackingAngle, type TrackingFrame, type TrackingKind, type TrackingSide } from '../../shared/repCounter';

function cancelled() { return new DOMException('Counting cancelled.', 'AbortError'); }

function waitForEvent(target: EventTarget, event: string, signal: AbortSignal, start?: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); target.removeEventListener(event, done); target.removeEventListener('error', failed); signal.removeEventListener('abort', aborted); };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('This video could not be decoded. Try an MP4 video or enter reps manually.')); };
    const aborted = () => { cleanup(); reject(cancelled()); };
    const timer = setTimeout(failed, 15_000);
    target.addEventListener(event, done, { once: true }); target.addEventListener('error', failed, { once: true }); signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted(); else { try { start?.(); } catch { failed(); } }
  });
}

function request(worker: Worker, command: unknown, signal: AbortSignal, transfer: Transferable[] = []): Promise<{ type: string; frame?: TrackingFrame }> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); worker.removeEventListener('message', receive); worker.removeEventListener('error', failed); signal.removeEventListener('abort', aborted); };
    const failed = () => { cleanup(); reject(new Error('Local counting could not run. Try again or enter reps manually.')); };
    const aborted = () => { cleanup(); reject(cancelled()); };
    const receive = (event: MessageEvent) => { cleanup(); if (event.data.type === 'error') reject(new Error(event.data.message)); else resolve(event.data); };
    const timer = setTimeout(failed, 30_000);
    worker.addEventListener('message', receive); worker.addEventListener('error', failed); signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted(); else { try { worker.postMessage(command, transfer); } catch { failed(); } }
  });
}

/** Samples decoded frames in order, using video time rather than processing time. */
async function visitRecordedFrames(video: HTMLVideoElement, kind: TrackingKind | 'auto', side: TrackingSide, signal: AbortSignal, progress: (percent: number) => void, visit: (frame: TrackingFrame) => void) {
  if (!window.Worker || !window.createImageBitmap || !window.OffscreenCanvas) throw new Error('Local counting is unavailable on this device. Enter reps manually.');
  if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 120) throw new Error('Choose a video up to 2 minutes long.');
  video.pause();
  const worker = new Worker(new URL('../workers/pose.worker.ts', import.meta.url));
  try {
    await request(worker, { type: 'init', baseUrl: window.location.origin }, signal);
    if (video.readyState < 2) await waitForEvent(video, 'loadeddata', signal);
    const frames = Math.ceil(video.duration * 10);
    for (let index = 0; index < frames; index++) {
      if (signal.aborted) throw cancelled();
      const time = index / 10;
      if (Math.abs(video.currentTime - time) > 0.001) await waitForEvent(video, 'seeked', signal, () => { video.currentTime = time; });
      if (video.readyState < 2) await waitForEvent(video, 'loadeddata', signal);
      const width = Math.min(480, video.videoWidth);
      const dimensions = { resizeWidth: width, resizeHeight: Math.max(1, Math.round(video.videoHeight * width / video.videoWidth)) };
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(video, dimensions);
      } catch {
        // Some mobile/Chromium decoders report seek completion before the
        // first image is usable. Re-seek once; never infer twice for a sample.
        if (signal.aborted) throw cancelled();
        await waitForEvent(video, 'seeked', signal, () => { video.currentTime = Math.min(video.duration - 0.001, time + 0.001); });
        if (video.readyState < 2) await waitForEvent(video, 'loadeddata', signal);
        try { bitmap = await createImageBitmap(video, dimensions); }
        catch { throw new Error('This video frame could not be decoded. Try an MP4 video or enter reps manually.'); }
      }
      if (signal.aborted) { bitmap.close(); throw cancelled(); }
      try {
        const result = await request(worker, { type: 'frame', bitmap, timestamp: index * 100 + 1, kind, side }, signal, [bitmap]);
        if (!result.frame) throw new Error('Local counting returned no frame. Try again.');
        visit(result.frame);
      } finally { bitmap.close(); }
      progress(Math.round((index + 1) / frames * 100));
    }
    if (signal.aborted) throw cancelled();
  } finally { worker.terminate(); }
}

export async function analyzeRecordedVideo(video: HTMLVideoElement, kind: TrackingKind, side: TrackingSide, signal: AbortSignal, progress: (percent: number) => void) {
  const counter = createRepCounter(kind);
  let visibleFrames = 0;
  await visitRecordedFrames(video, kind, side, signal, progress, frame => {
    if (trackingAngle(frame, kind) !== null) visibleFrames++;
    counter.update(frame);
  });
  if (!visibleFrames) throw new Error('The required joints were not visible. Try the other side or enter reps manually.');
  return counter.snapshot().reps;
}

export async function identifyRecordedVideo(video: HTMLVideoElement, signal: AbortSignal, progress: (percent: number) => void) {
  const identifier = createExerciseIdentifier();
  await visitRecordedFrames(video, 'auto', 'left', signal, progress, frame => identifier.update(frame));
  const result = identifier.result();
  if (!result) throw new Error('Could not identify one supported exercise. Use a single side-on squat, biceps curl or floor push-up clip, or select the exercise and enter reps manually.');
  return result;
}
