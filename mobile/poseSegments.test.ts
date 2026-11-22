import { describe, expect, it } from 'vitest';
import { createStablePoseSegments } from './poseSegments';

describe('stable pose segments', () => {
  it('keeps a single missing bone briefly without freezing other visible bones', () => {
    const overlay = createStablePoseSegments([[0, 1], [1, 2]], 0.5, 500);
    const p = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
    expect(overlay.update(p, 0)).toEqual(['M1,1L2,2', 'M2,2L3,3']);
    expect(overlay.update([{ ...p[0], x: 4 }, p[1], undefined], 200)).toEqual(['M4,1L2,2', 'M2,2L3,3']);
    expect(overlay.update([{ ...p[0], x: 4 }, p[1], undefined], 501)).toEqual(['M4,1L2,2', '']);
    overlay.reset();
    expect(overlay.update([p[0], p[1], undefined], 502)).toEqual(['M1,1L2,2', '']);
  });
});
