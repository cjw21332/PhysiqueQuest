import { describe, expect, it } from 'vitest';
import { createPoseSubjectSelector } from '../poseSubject';
const person = (x: number, visibility = 1) => Array.from({ length: 33 }, () => ({ x, y: .5, visibility }));
describe('central subject selection', () => {
  it('selects the central credible person independent of detector order', () => {
    const selector = createPoseSubjectSelector();
    const center = person(.5), bystander = person(.1);
    expect(selector.select([bystander, center]).landmarks).toBe(center);
    expect(selector.select([person(.5, .1), bystander]).changed).toBe(true);
  });
  it('ignores unobservable torsos and preserves identity through a missing frame', () => {
    const selector = createPoseSubjectSelector();
    selector.select([person(.5)]);
    expect(selector.select([person(.5, .1)]).landmarks).toEqual([]);
    expect(selector.select([person(.51)]).changed).toBe(false);
  });
});
