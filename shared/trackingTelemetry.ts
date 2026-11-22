/** Debug-only, bounded aggregates. Callers supply monotonic milliseconds. */
export type TrackingWindow = {
  startMs: number; endMs: number; results: number; busySkips: number;
  latencyP50: number | null; latencyP95: number | null;
  inferenceP50: number | null; inferenceP95: number | null;
  drawP50: number | null; drawP95: number | null;
};

export function createTrackingTelemetry(windowMs = 5000, limit = 360) {
  if (!(windowMs > 0) || !Number.isInteger(limit) || limit < 1) throw new Error('Invalid telemetry bounds');
  const windows: TrackingWindow[] = [];
  let start: number | null = null, results = 0, busySkips = 0;
  let latency: number[] = [], inference: number[] = [], draw: number[] = [];
  const quantile = (values: number[], q: number) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.ceil(q * sorted.length) - 1];
  };
  const current = (endMs: number): TrackingWindow => ({ startMs: start!, endMs, results, busySkips,
    latencyP50: quantile(latency, .5), latencyP95: quantile(latency, .95),
    inferenceP50: quantile(inference, .5), inferenceP95: quantile(inference, .95),
    drawP50: quantile(draw, .5), drawP95: quantile(draw, .95) });
  const rotate = (now: number) => {
    if (!Number.isFinite(now)) return;
    if (start === null) { start = now; return; }
    if (now < start + windowMs) return;
    windows.push(current(now));
    if (windows.length > limit) windows.shift();
    start = now; results = 0; busySkips = 0; latency = []; inference = []; draw = [];
  };
  const add = (samples: number[], value: number | null) => { if (value !== null && Number.isFinite(value) && value >= 0 && samples.length < 300) samples.push(value); };
  return {
    recordResult(now: number, captureToResult: number | null, inferenceMs: number | null, drawMs: number | null) {
      rotate(now); results++; add(latency, captureToResult); add(inference, inferenceMs); add(draw, drawMs);
    },
    recordBusySkip(now: number) { rotate(now); busySkips++; },
    snapshot(now: number) { rotate(now); return windows.map(window => ({ ...window })); },
    snapshotWithPartial(now: number) {
      rotate(now);
      return [...windows.map(window => ({ ...window, partial: false })),
        ...(start !== null && now > start ? [{ ...current(now), partial: true }] : [])];
    },
  };
}
