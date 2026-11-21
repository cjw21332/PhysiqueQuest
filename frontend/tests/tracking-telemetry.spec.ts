import { describe, expect, it } from 'vitest';
import { createTrackingTelemetry } from '../lib/trackingTelemetry';

describe('tracking telemetry aggregation', () => {
  it('aggregates result latency, inference, drawing and busy skips', () => {
    const telemetry = createTrackingTelemetry();
    telemetry.recordResult(0, 10, 4, 1);
    telemetry.recordResult(1000, 30, 8, 3);
    telemetry.recordBusySkip(2000);
    expect(telemetry.snapshot(5000)).toEqual([{ startMs: 0, endMs: 5000, results: 2, busySkips: 1,
      latencyP50: 10, latencyP95: 30, inferenceP50: 4, inferenceP95: 8, drawP50: 1, drawP95: 3 }]);
  });
  it('retains at most the configured number of windows', () => {
    const telemetry = createTrackingTelemetry(5000, 2);
    telemetry.recordBusySkip(0);
    telemetry.recordBusySkip(5000);
    telemetry.recordBusySkip(10000);
    const windows = telemetry.snapshot(15000);
    expect(windows).toHaveLength(2);
    expect(windows.map(window => window.startMs)).toEqual([5000, 10000]);
  });
});
