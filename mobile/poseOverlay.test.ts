import { describe, expect, it } from 'vitest';
import { createPoseOverlay } from './poseOverlay';

describe('pose overlay dropout', () => {
  it('holds a dropped frame and clears after 350 ms', () => {
    const overlay = createPoseOverlay();
    const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
    overlay.update(points, 100);
    overlay.update([], 150);
    expect(overlay.read(150).points).toHaveLength(33);
    expect(overlay.read(150).opacity).toBeGreaterThan(0);
    expect(overlay.read(450)).toEqual({ points: [], opacity: 0 });
  });
});
