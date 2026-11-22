import { describe, expect, it } from 'vitest';
import { createTrackingTelemetry } from '../trackingTelemetry';

describe('tracking telemetry shared aggregation', () => {
  it('keeps unavailable metric samples null', () => {
    const log = createTrackingTelemetry();
    log.recordResult(100, null, 22, null);
    expect(log.snapshot(5100)[0]).toMatchObject({ latencyP50: null, latencyP95: null, inferenceP50: 22, drawP95: null });
  });
  it('exports a partial window without changing the completed snapshots', () => {
    const log = createTrackingTelemetry();
    log.recordResult(100, null, 20, null);
    expect(log.snapshotWithPartial(600)).toMatchObject([{ startMs: 100, endMs: 600, partial: true, results: 1 }]);
    expect(log.snapshot(600)).toEqual([]);
  });
  it('bounds completed windows even when partial snapshots are requested', () => {
    const log = createTrackingTelemetry(5000, 2);
    for (let i = 0; i < 4; i++) log.recordResult(i * 5000, null, 1, null);
    expect(log.snapshotWithPartial(16000)).toHaveLength(3);
    expect(log.snapshot(16000)).toHaveLength(2);
  });
});
