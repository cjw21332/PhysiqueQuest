import { describe, expect, it } from 'vitest';
import { createPoseSafety } from './poseSafety';
const pose = () => Array.from({ length: 33 }, (_, i) => ({ x: .3 + i * .005, y: .1 + i * .02, visibility: 1 }));
describe('pose inactivity monitoring', () => {
  it('starts a countdown after 30 seconds and sounds after another 30', () => {
    const safety = createPoseSafety(), p = pose(); safety.start(0);
    for (let t = 0; t <= 30000; t += 1000) { safety.observe(p, t); safety.tick(t); }
    expect(safety.tick(30000)).toEqual({ phase: 'countdown', seconds: 30 });
    for (let t = 31000; t <= 60000; t += 1000) { safety.observe(p, t); safety.tick(t); }
    expect(safety.tick(60000).phase).toBe('alarm');
  });
  it('starts the warning after 30 seconds even when the pose disappears', () => {
    const safety = createPoseSafety(); safety.start(0); safety.observe(pose(), 0);
    expect(safety.tick(29999).phase).toBe('monitoring');
    expect(safety.tick(30000).phase).toBe('countdown');
    expect(safety.tick(60000).phase).toBe('alarm');
  });
  it('keeps elapsed inactivity when the pose returns after being lost', () => {
    const safety = createPoseSafety(); safety.start(0); safety.observe(pose(), 0);
    safety.observe(pose(), 20000);
    expect(safety.tick(30000).phase).toBe('countdown');
  });
  it('uses phone movement while the person is out of frame', () => {
    const safety = createPoseSafety(); safety.start(0); safety.observe(pose(), 0);
    safety.movement(25000);
    expect(safety.tick(30000).phase).toBe('monitoring');
    expect(safety.tick(55000).phase).toBe('countdown');
  });
  it('ignores camera translation but cancels for body movement', () => {
    const safety = createPoseSafety(), p = pose(); safety.start(0);
    for (let t = 0; t <= 30000; t += 1000) { safety.observe(p.map(q => ({ ...q, x: q.x + .03 })), t); safety.tick(t); }
    expect(safety.tick(30000).phase).toBe('countdown');
    const moved = p.map(q => ({ ...q })); moved[13].x += .2; moved[15].x += .2;
    safety.observe(moved, 30500);
    expect(safety.tick(30500).phase).toBe('monitoring');
  });
  it('cancels the warning when the user confirms they are okay', () => {
    const safety = createPoseSafety(), p = pose(); safety.start(0);
    for (let t = 0; t <= 30000; t += 1000) { safety.observe(p, t); safety.tick(t); }
    safety.okay(30000);
    expect(safety.tick(30000).phase).toBe('monitoring');
    expect(safety.tick(32000).phase).toBe('monitoring');
  });
  it('cancels a countdown when the phone moves', () => {
    const safety = createPoseSafety(), p = pose(); safety.start(0);
    for (let t = 0; t <= 30000; t += 1000) { safety.observe(p, t); safety.tick(t); }
    expect(safety.tick(30000).phase).toBe('countdown');
    safety.movement(30500);
    expect(safety.tick(30500).phase).toBe('monitoring');
  });
});
