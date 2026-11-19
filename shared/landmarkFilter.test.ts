import { describe, expect, it } from 'vitest';
import { createLandmarkFilter } from './landmarkFilter';

describe('landmark filtering', () => {
  it('reduces alternating jitter and supports bypass', () => {
    const filter = createLandmarkFilter();
    const bypass = createLandmarkFilter(false, true);
    let error = 0;
    for (let i = 0; i < 60; i++) {
      const point = { x: 0.5 + (i % 2 ? 0.02 : -0.02), y: 0.5 };
      error += Math.abs(filter.update([point], i * 100)[0].x - 0.5);
      expect(bypass.update([point], i * 100)[0]).toEqual(point);
    }
    expect(error / 60).toBeLessThan(0.01);
  });
  it('keeps fast-family lag below 100 ms on a one-hertz sine', () => {
    const filter = createLandmarkFilter(true);
    const samples: Array<{ t: number; x: number }> = [];
    for (let i = 0; i < 150; i++) {
      const t = i / 15;
      const x = 0.5 + 0.2 * Math.sin(2 * Math.PI * t);
      const filtered = filter.update([{ x, y: 0.5 }], t * 1000)[0].x;
      if (i >= 30) samples.push({ t, x: filtered });
    }
    const error = (lag: number) => samples.reduce((sum, sample) => sum + (sample.x - (0.5 + 0.2 * Math.sin(2 * Math.PI * (sample.t - lag)))) ** 2, 0);
    let best = 0;
    for (let lag = 0.001; lag <= 0.2; lag += 0.001) if (error(lag) < error(best)) best = lag;
    expect(best).toBeLessThan(0.1);
  });
});
