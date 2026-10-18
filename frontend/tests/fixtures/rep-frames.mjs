// Synthetic landmark geometry for rule/contract tests; not a human accuracy dataset.
export function movementFrame(kind, angle, timestamp = 0, aspect = 1) {
  const point = (x, y) => ({ x: x / aspect, y, visibility: 1, presence: 1 });
  const radians = angle * Math.PI / 180;
  if (kind === 'hiphinge') {
    return { timestamp, aspect, joints: [point(.3 - .25 * Math.sin(radians), .5 + .25 * Math.cos(radians)), point(.3, .5), point(.3, .75), point(.3, .95)] };
  }
  if (kind === 'bridge') {
    return { timestamp, aspect, joints: [point(.1, .75), point(.3, .6 + (angle - 90) / 90 * .2), point(.5, .45), point(.5, .75)] };
  }
  if (kind === 'lunge') {
    const hip = point(.4 - .2 * Math.sin(radians), .65 + .2 * Math.cos(radians));
    return { timestamp, aspect, joints: [hip, point(.4, .65), point(.4, .85), point(.1, .65), point(.05, .85), { ...hip, y: hip.y - .3 }] };
  }
  if (kind === 'row') {
    const direction = (angle - 90) * Math.PI / 180;
    const ex = .2 + .17 * Math.cos(direction), ey = .3 + .17 * Math.sin(direction);
    return { timestamp, aspect, joints: [point(.42, .4), point(.2, .3), point(ex, ey), point(ex, ey + .17), point(.43, .7)] };
  }
  if (kind === 'tricepsextension') {
    return { timestamp, aspect, joints: [point(.25, .8), point(.25, .45), point(.25, .28), point(.25 + .17 * Math.sin(radians), .28 + .17 * Math.cos(radians))] };
  }
  if (kind === 'shoulderpress') {
    const direction = (90 - angle) * Math.PI / 180;
    const ex = .25 + .13 * Math.cos(direction), ey = .4 + .13 * Math.sin(direction);
    return { timestamp, aspect, joints: [point(.25, .75), point(.25, .4), point(ex, ey), point(ex, ey - .13)] };
  }
  if (kind === 'lateralraise') {
    const elevation = Math.PI - radians;
    const dx = .13 * Math.sin(elevation), dy = .13 * Math.cos(elevation);
    return { timestamp, aspect, joints: [point(.2, .75), point(.2, .4), point(.2 + dx, .4 + dy), point(.2 + 2 * dx, .4 + 2 * dy)] };
  }
  if (kind === 'wallpushup') {
    const bend = (180 - angle) / 2 * Math.PI / 180;
    const ex = .2 + .12 * Math.cos(bend), ey = .3 + .12 * Math.sin(bend);
    return { timestamp, aspect, joints: [point(.2, .3), point(ex, ey), point(.2 + .24 * Math.cos(bend), .3), point(.2, .55), point(.2, .85)] };
  }
  return { timestamp, aspect, joints: [point(.2, .3), point(.2, .5), point(.2 + .2 * Math.sin(radians), .5 - .2 * Math.cos(radians)), point(.35, .3), point(.48, .3)] };
}

export function wholeMovementFrame(kind, angle, timestamp = 0, side = 'left', aspect = 1) {
  const selected = movementFrame(kind, angle, timestamp, aspect);
  const joints = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  const indices = kind === 'hiphinge' || kind === 'bridge' ? side === 'left' ? [11, 23, 25, 27] : [12, 24, 26, 28]
    : kind === 'lunge' ? side === 'left' ? [23, 25, 27, 26, 28, 11] : [24, 26, 28, 25, 27, 12]
    : kind === 'row' ? side === 'left' ? [23, 11, 13, 15, 25] : [24, 12, 14, 16, 26]
    : kind === 'shoulderpress' || kind === 'lateralraise' || kind === 'tricepsextension'
    ? side === 'left' ? [23, 11, 13, 15] : [24, 12, 14, 16]
    : side === 'left' ? [11, 13, 15, 23, kind === 'kneepushup' ? 25 : 27] : [12, 14, 16, 24, kind === 'kneepushup' ? 26 : 28];
  indices.forEach((index, position) => { joints[index] = selected.joints[position]; });
  if (kind === 'row') joints[side === 'left' ? 27 : 28] = { x: .43 / aspect, y: .9, visibility: 1 };
  if (kind === 'tricepsextension') {
    joints[side === 'left' ? 25 : 26] = { x: .25 / aspect, y: .88, visibility: 1 };
    joints[side === 'left' ? 27 : 28] = { x: .25 / aspect, y: .96, visibility: 1 };
  }
  if (kind === 'shoulderpress' || kind === 'lateralraise') {
    joints[side === 'left' ? 25 : 26] = { x: .25 / aspect, y: .84, visibility: 1 };
    joints[side === 'left' ? 27 : 28] = { x: .25 / aspect, y: .96, visibility: 1 };
    if (kind === 'lateralraise') joints[side === 'left' ? 12 : 11] = { x: .05 / aspect, y: .4, visibility: 1 };
  }
  return { ...selected, joints };
}
