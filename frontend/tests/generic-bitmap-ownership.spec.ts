import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setup = vi.hoisted(() => ({ cleanup: undefined as undefined | (() => void), statuses: [] as string[] }));
vi.mock('react', () => ({
  useRef: (current: unknown) => ({ current }),
  useMemo: (fn: () => unknown) => fn(),
  useState: (value: unknown) => [typeof value === 'function' ? (value as () => unknown)() : value, (v: unknown) => setup.statuses.push(String(v))],
  useEffect: (fn: () => undefined | (() => void)) => { setup.cleanup = fn(); },
}));
vi.mock('../../shared/landmarkFilter', () => ({ createLandmarkFilter: () => ({ reset() {}, update: (x: unknown) => x }) }));
vi.mock('../../shared/genericRepCounter', () => ({ createGenericRepCounter: () => ({ getProgress: () => ({}), suspend() {}, tick() {}, update() {} }) }));
vi.mock('../../shared/exerciseEngine', () => ({ createExerciseCounter: () => ({}) }));

import { useGenericRepTracking } from '../hooks/useGenericRepTracking';

describe('generic camera bitmap ownership', () => {
  let worker: { onmessage?: (event: unknown) => void; onerror?: () => void; postMessage: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    vi.useFakeTimers(); setup.cleanup = undefined; setup.statuses = [];
    worker = { postMessage: vi.fn(), terminate: vi.fn() };
    vi.stubGlobal('Worker', function () { return worker; });
    vi.stubGlobal('OffscreenCanvas', function () {});
    vi.stubGlobal('window', { Worker: globalThis.Worker, OffscreenCanvas: globalThis.OffscreenCanvas, createImageBitmap: () => {}, setInterval, clearInterval, setTimeout, clearTimeout, location: { origin: 'http://localhost' } });
    vi.stubGlobal('navigator', {});
    vi.spyOn(performance, 'now').mockReturnValue(1000);
  });
  afterEach(() => { setup.cleanup?.(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const start = () => {
    const video = { current: { readyState: 4, videoWidth: 640, videoHeight: 480, currentTime: 1 } };
    useGenericRepTracking({} as never, true, video as never);
    worker.onmessage?.({ data: { type: 'ready' } });
  };
  it('closes its locally owned bitmap if transfer throws', async () => {
    const bitmap = { close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    worker.postMessage.mockImplementation((message: {type: string}) => { if (message.type === 'generic-frame') throw Error('transfer failed'); });
    start(); await vi.advanceTimersByTimeAsync(50);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
  it('closes a bitmap that resolves after stop, without posting it', async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal('createImageBitmap', vi.fn(() => new Promise(r => { resolve = r; })));
    start(); await vi.advanceTimersByTimeAsync(50);
    setup.cleanup?.(); setup.cleanup = undefined;
    const bitmap = { close: vi.fn() }; resolve(bitmap); await Promise.resolve(); await Promise.resolve();
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
  });
});
