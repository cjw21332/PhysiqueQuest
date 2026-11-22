import { createTrackingTelemetry } from './trackingTelemetry';

export type NativeTelemetryContext = { exercise: string; pattern: string; facing: 'front' | 'back'; targetFps: number };
export type NativeTelemetryEvent = { atMs: number; kind: 'interrupted' | 'recovering' | 'failed' | 'background' | 'foreground'; reason: string | null };

/** Aggregate only metadata already available to JS. No images or landmarks. */
export function createNativeTelemetrySession(context: NativeTelemetryContext, startedAtMs: number, limit = 360) {
  if (!Number.isFinite(startedAtMs) || !Number.isInteger(limit) || limit < 1) throw Error('Invalid telemetry configuration');
  let currentContext = { ...context }, start = startedAtMs, events: NativeTelemetryEvent[] = [];
  let aggregation = createTrackingTelemetry(5000, 1);
  const completed: ReturnType<typeof makeWindow>[] = [];
  function makeWindow(now: number, partial: boolean) {
    const timing = aggregation.snapshotWithPartial(now).at(-1);
    const results = timing?.results ?? 0;
    return {
      startMs: start, endMs: now, partial, ...currentContext, results,
      resultsPerSecond: now > start ? results * 1000 / (now - start) : null,
      captureToResultMs: null, captureToResultReason: 'capture timestamp is not exposed to the JS tracker',
      inferenceMs: null, inferenceReason: 'inference duration is not forwarded to the JS tracker',
      thermalState: null, thermalReason: 'thermal state is not forwarded to the JS tracker',
      drawMs: null, drawReason: 'native overlay render completion is not exposed',
      busySkips: null, busySkipsReason: 'native camera scheduling is not exposed',
      liveFrames: null, liveFramesReason: 'native frame ownership is not exposed',
      jsHeapBytes: null, jsHeapReason: 'native JS heap measurement is not exposed',
      events: events.map(event => ({ ...event })),
    };
  }
  function finish(now: number) {
    if (now <= start) return;
    completed.push(makeWindow(now, false));
    if (completed.length > limit) completed.shift();
    start = now; events = []; aggregation = createTrackingTelemetry(5000, 1);
  }
  function rotate(now: number) { if (Number.isFinite(now) && now >= start + 5000) finish(now); }
  return {
    frame(now: number) { rotate(now); aggregation.recordResult(now, null, null, null); },
    event(event: NativeTelemetryEvent) { rotate(event.atMs); if (events.length < 100) events.push({ ...event }); },
    context(now: number, next: NativeTelemetryContext) { finish(now); currentContext = { ...next }; },
    export(now: number) { rotate(now); return [...completed, makeWindow(now, true)].slice(-(limit + 1)); },
  };
}
