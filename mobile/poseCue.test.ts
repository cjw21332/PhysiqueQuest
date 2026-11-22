import { describe, expect, it } from 'vitest';
import { createPoseCueController, type PoseCue } from './poseCue';

describe('pose cue debounce', () => {
  it('selects alignment over depth over tempo', () => {
    const tempo: PoseCue = { id: 'tempo', message: 'Steady', priority: 'tempo' };
    const depth: PoseCue = { id: 'depth', message: 'Range', priority: 'depth' };
    const alignment: PoseCue = { id: 'alignment', message: 'Align', priority: 'alignment' };
    expect(createPoseCueController().update(0, [tempo, depth, alignment]).cue).toEqual(alignment);
    expect(createPoseCueController().update(0, [tempo, depth]).cue).toEqual(depth);
    expect(createPoseCueController().update(0, [tempo]).cue).toEqual(tempo);
  });
  it('immediately replaces a lower priority cue and speaks the displayed cue', () => {
    const controller = createPoseCueController();
    const depth: PoseCue = { id: 'depth', message: 'Lower', priority: 'depth' };
    const alignment: PoseCue = { id: 'alignment', message: 'Align', priority: 'alignment' };
    expect(controller.update(0, [depth])).toEqual({ cue: depth, speak: true });
    expect(controller.update(100, [depth, alignment])).toEqual({ cue: alignment, speak: true });
    expect(controller.update(200, [depth])).toEqual({ cue: alignment, speak: false });
  });
  it('prioritizes alignment, holds cues and rate limits speech', () => {
    const controller = createPoseCueController();
    const depth: PoseCue = { id: 'depth', message: 'Lower', priority: 'depth' };
    const alignment: PoseCue = { id: 'body_line', message: 'Align', priority: 'alignment' };
    expect(controller.update(0, [depth, alignment])).toEqual({ cue: alignment, speak: true });
    expect(controller.update(1000, [depth])).toEqual({ cue: alignment, speak: false });
    expect(controller.update(1500, [depth])).toEqual({ cue: depth, speak: true });
    expect(controller.update(3000, [alignment], true)).toEqual({ cue: alignment, speak: false });
    expect(controller.update(3999, [alignment])).toEqual({ cue: alignment, speak: false });
    expect(controller.update(4000, [alignment])).toEqual({ cue: alignment, speak: true });
    expect(controller.update(5000, [])).toEqual({ cue: null, speak: false });
  });
});
