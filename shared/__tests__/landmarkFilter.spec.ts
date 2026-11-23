import { describe, expect, it } from 'vitest';
import { createLandmarkFilter } from '../landmarkFilter';

describe('landmark filtering', () => {
  it('reduces alternating stationary jitter', () => {
    const filter = createLandmarkFilter();
    const values = Array.from({ length: 80 }, (_, i) => filter.update([{ x: 0.5 + (i % 2 ? 0.03 : -0.03), y: 0.5 }], i * 50)[0].x);
    expect(Math.max(...values.slice(20)) - Math.min(...values.slice(20))).toBeLessThan(0.06);
  });
  it('keeps delayed frames from rewinding the displayed pose', () => {
    const filter = createLandmarkFilter();
    filter.update([{ x: 0.6, y: 0.5 }], 100);
    expect(filter.update([{ x: 0, y: 0 }], 80)[0].x).toBe(0.6);
    expect(filter.update([{ x: 0.6, y: 0.5 }], 120)[0].x).toBeCloseTo(0.6);
  });
  it('recovers the depth coordinate after a missing depth measurement', () => {
    const filter = createLandmarkFilter();
    filter.update([{ x: 0, y: 0, z: NaN }], 0);
    expect(filter.update([{ x: 0, y: 0, z: 0.2 }], 20)[0].z).toBe(0.2);
  });
  it('bypasses filtering when requested', () => {
    const filter = createLandmarkFilter(false, true);
    filter.update([{ x: 0, y: 0 }], 0);
    expect(filter.update([{ x: 1, y: 1 }], 50)[0]).toEqual({ x: 1, y: 1 });
  });
  it('keeps lag below 100 ms for fast one-hertz movement', () => {
    const filter = createLandmarkFilter(true);
    const output: number[] = [];
    for (let i = 0; i < 120; i++) output.push(filter.update([{ x: Math.sin(2 * Math.PI * i / 60), y: 0 }], i * 1000 / 60)[0].x);
    const peak = output.slice(60, 110).indexOf(Math.max(...output.slice(60, 110))) + 60;
    expect((peak - 75) * 1000 / 60).toBeLessThan(100);
  });
});
