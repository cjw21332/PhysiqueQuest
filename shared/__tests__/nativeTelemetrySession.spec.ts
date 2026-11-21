import { describe, expect, it } from 'vitest';
import { createNativeTelemetrySession } from '../nativeTelemetrySession';

const context = { exercise: 'Bench', pattern: 'horizontal_push', facing: 'back' as const, targetFps: 15 };
describe('native telemetry session', () => {
  it('exports completed and current windows with unavailable metrics and recovery events', () => {
    const log = createNativeTelemetrySession(context, 0);
    log.frame(100);
    log.event({ atMs: 200, kind: 'interrupted', reason: 'background' });
    log.frame(5100);
    const windows = log.export(6000);
    expect(windows).toHaveLength(2);
    expect(windows[0]).toMatchObject({ results: 1, captureToResultMs: null, inferenceMs: null, thermalState: null,
      events: [{ kind: 'interrupted', reason: 'background' }], partial: false });
    expect(windows[1]).toMatchObject({ results: 1, partial: true, exercise: 'Bench', facing: 'back' });
  });
  it('caps the completed records and keeps an additional in-progress record', () => {
    const log = createNativeTelemetrySession(context, 0, 2);
    for (let i = 0; i < 5; i++) log.frame(i * 5000 + 100);
    expect(log.export(22000)).toHaveLength(3);
  });
  it('closes the previous segment when context changes', () => {
    const log = createNativeTelemetrySession(context, 0);
    log.frame(100); log.context(500, { ...context, facing: 'front' }); log.frame(600);
    expect(log.export(900).map(row => row.facing)).toEqual(['back', 'front']);
  });
});
