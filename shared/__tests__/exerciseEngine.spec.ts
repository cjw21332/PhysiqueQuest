import { describe, expect, it } from 'vitest';
import { createLandmarkFilter } from '../landmarkFilter';
import {
  analyzeSequence,
  createExerciseCounter,
  jointAngle,
  patternSpec,
  resolvePatternSpec,
  screenForm,
  type Landmark,
  type PatternId,
  type PoseFrame,
} from '../exerciseEngine';

const blank = (): Landmark[] =>
  Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1, presence: 1 }));

/**
 * Place a triplet so the interior angle at `b` equals `angle`, with the first
 * ray pointing straight up. Keeps tests independent of MediaPipe conventions.
 */
function setAngle(landmarks: Landmark[], [a, b, c]: readonly [number, number, number], angle: number, bx = 0.5, by = 0.5, length = 0.12) {
  landmarks[a] = { x: bx, y: by - length, z: 0, visibility: 1, presence: 1 };
  landmarks[b] = { x: bx, y: by, z: 0, visibility: 1, presence: 1 };
  const radians = ((-90 + angle) * Math.PI) / 180;
  landmarks[c] = { x: bx + length * Math.cos(radians), y: by + length * Math.sin(radians), z: 0, visibility: 1, presence: 1 };
}

function frame(pattern: PatternId, angle: number, timestamp: number, aspect = 1): PoseFrame {
  const landmarks = blank();
  const spec = patternSpec(pattern);
  // Both sides start together; individual tests can override one side.
  setAngle(landmarks, spec.joints.left, angle, 0.5, 0.5);
  setAngle(landmarks, spec.joints.right, angle, 0.45, 0.5);
  return { landmarks, timestamp, aspect };
}

function holdAt(angle: number, timestamp: number): PoseFrame {
  const landmarks = blank();
  const spec = patternSpec('core_isometric');
  setAngle(landmarks, spec.joints.left, angle);
  setAngle(landmarks, spec.joints.right, angle, 0.45, 0.5);
  return { landmarks, timestamp, aspect: 1 };
}

function cycle(pattern: PatternId, from: number, to: number, start: number, step = 150) {
  const down = [from, (from + to) / 2, to, to, (from + to) / 2, from];
  return down.map((angle, index) => frame(pattern, angle, start + index * step));
}

describe('jointAngle', () => {
  it('measures a straight limb as 180 degrees', () => {
    const landmarks = blank();
    setAngle(landmarks, [23, 25, 27], 180);
    expect(jointAngle({ landmarks, aspect: 1 }, [23, 25, 27])).toBeCloseTo(180, 4);
  });

  it('measures a right angle as 90 degrees', () => {
    const landmarks = blank();
    setAngle(landmarks, [23, 25, 27], 90);
    expect(jointAngle({ landmarks, aspect: 1 }, [23, 25, 27])).toBeCloseTo(90, 4);
  });

  it('corrects for frame aspect so portrait video keeps its true angle', () => {
    const landmarks = blank();
    setAngle(landmarks, [23, 25, 27], 60);
    const landscape = jointAngle({ landmarks, aspect: 1 }, [23, 25, 27])!;
    const portrait = jointAngle({ landmarks, aspect: 0.5 }, [23, 25, 27])!;
    expect(landscape).toBeCloseTo(60, 4);
    expect(portrait).not.toBeCloseTo(60, 1);
  });

  it('returns null when a landmark is not visible', () => {
    const landmarks = blank();
    setAngle(landmarks, [23, 25, 27], 90);
    landmarks[25] = { ...landmarks[25], visibility: 0.2 };
    expect(jointAngle({ landmarks, aspect: 1 }, [23, 25, 27], 0.5)).toBeNull();
  });
});

describe('repetition counting', () => {
  it.each(['chest_fly', 'hip_abduction'] as const)('counts %s using its working shoulder/hip geometry', pattern => {
    const spec = patternSpec(pattern), counter = createExerciseCounter(pattern);
    const angles = [spec.startAngle, (spec.startAngle + spec.peakAngle) / 2, spec.peakAngle, spec.peakAngle, (spec.startAngle + spec.peakAngle) / 2, spec.startAngle];
    angles.forEach((angle, i) => {
      const landmarks = blank().map(p => ({ ...p, visibility: 0 }));
      setAngle(landmarks, spec.joints.left, angle);
      counter.update({ landmarks, timestamp: i * 150 + 1, aspect: 1 });
    });
    expect(counter.snapshot().reps).toBe(1);
  });
  it('keeps per-side mode when an override changes visibility alone', () => {
    expect(resolvePatternSpec('curl', { visibility: .45 }).mode).toBe('per_side');
    expect(resolvePatternSpec('horizontal_pull', { mode: 'per_side' }).mode).toBe('per_side');
  });
  it('counts a single sampled peak during a continuous press', () => {
    const counter = createExerciseCounter('horizontal_push');
    [170, 140, 110, 85, 110, 140, 170].forEach((angle, i) => counter.update(frame('horizontal_push', angle, i * 100 + 1)));
    expect(counter.snapshot().reps).toBe(1);
  });
  it('continues a bilateral press when the near wrist is briefly occluded', () => {
    const counter = createExerciseCounter('horizontal_push');
    [170, 150, 130, 110, 90, 85, 85, 100, 120, 140, 170].forEach((angle, i) => {
      const sample = frame('horizontal_push', angle, i * 100 + 1);
      if (i >= 2 && i <= 8) sample.landmarks = sample.landmarks.map((p, index) => index === 15 ? { ...p, visibility: 0 } : p);
      counter.update(sample);
    });
    expect(counter.snapshot().reps).toBe(1);
  });
  it('counts continuous near-threshold squats from measurements even when display smoothing reduces their depth', () => {
    const raw = createExerciseCounter('squat');
    const filtered = createExerciseCounter('squat');
    const display = createLandmarkFilter();
    const fps = 15, rate = 0.7, seconds = 10 / rate;
    for (let index = 0; index <= Math.ceil(seconds * fps); index++) {
      const t = Math.min(index / fps, seconds);
      const angle = 172 - 72 * (1 - Math.cos(2 * Math.PI * rate * t)) / 2;
      const pose = frame('squat', angle, index * 1000 / fps);
      raw.update(pose);
      filtered.update({ ...pose, landmarks: display.update(pose.landmarks, pose.timestamp) });
    }
    expect(raw.snapshot().reps).toBeGreaterThanOrEqual(9);
    expect(filtered.snapshot().reps).toBeLessThan(raw.snapshot().reps);
  });
  it('includes the standing angle when measuring a squat that returns to the standing threshold', () => {
    const counter = createExerciseCounter('squat');
    for (const [index, angle] of [172, 155, 135, 106, 135, 155, 161].entries()) {
      counter.update(frame('squat', angle, index * 150));
    }
    expect(counter.snapshot()).toMatchObject({ reps: 1, partials: 0 });
  });
  it('preserves the starting angle for another repetition family', () => {
    const counter = createExerciseCounter('horizontal_push');
    for (const [index, angle] of [170, 145, 125, 95, 95, 125, 145, 158].entries()) {
      counter.update(frame('horizontal_push', angle, index * 150));
    }
    expect(counter.snapshot()).toMatchObject({ reps: 1, partials: 0 });
  });
  it('counts a squat that reaches full depth for only one sampled frame', () => {
    const counter = createExerciseCounter('squat');
    for (const [index, angle] of [172, 155, 130, 105, 130, 155, 172].entries()) {
      counter.update(frame('squat', angle, index * 150));
    }
    expect(counter.snapshot()).toMatchObject({ reps: 1, partials: 0 });
  });
  it('emits depth and tempo feedback from incomplete movements', () => {
    const depth = createExerciseCounter('squat');
    let result = depth.snapshot();
    for (const [index, angle] of [172, 150, 120, 120, 150, 172].entries()) result = depth.update(frame('squat', angle, index * 150));
    expect(result.feedback).toBe('depth');
    const tempo = createExerciseCounter('squat');
    for (const [index, angle] of [172, 150, 110, 95, 95, 140, 172].entries()) result = tempo.update(frame('squat', angle, index * 20));
    expect(result.feedback).toBe('tempo');
  });
  it('rejects a peak-reaching cycle that is too fast without counting a partial', () => {
    const counter = createExerciseCounter('squat');
    let result = counter.snapshot();
    for (const [index, angle] of [172, 150, 110, 95, 95, 140, 172].entries()) result = counter.update(frame('squat', angle, index * 20));
    expect(result.rejection).toBe('timing_failed');
    expect(result.reps).toBe(0);
    expect(result.partials).toBe(0);
  });
  it.each(['squat', 'horizontal_push'] as const)('keeps %s counts stable with handheld motion', pattern => {
    let seed = 1234567;
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return (seed + 1) / 4294967297; };
    const gaussian = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
    const clean = createExerciseCounter(pattern), shaken = createExerciseCounter(pattern);
    const spec = patternSpec(pattern);
    const rate = 0.7, duration = 10 / rate;
    for (let i = 0; i <= Math.ceil(duration * 15); i++) {
      const t = i / 15;
      const progress = (1 - Math.cos(2 * Math.PI * rate * Math.min(t, duration))) / 2;
      const pose = frame(pattern, spec.startAngle + (spec.peakAngle - spec.startAngle) * progress, t * 1000);
      clean.update(pose);
      const dx = (random() * 2 - 1) * 0.03, dy = (random() * 2 - 1) * 0.03;
      shaken.update({ ...pose, landmarks: pose.landmarks.map(p => ({ ...p, x: p.x + dx + gaussian() * 0.001, y: p.y + dy + gaussian() * 0.001 })) });
    }
    expect(clean.snapshot().reps).toBeGreaterThanOrEqual(9);
    expect(Math.abs(shaken.snapshot().reps - clean.snapshot().reps)).toBeLessThanOrEqual(1);
  });
  it.each([1, 0.7])('counts ten push-ups at %s reps per second and 15 fps', rate => {
    const counter = createExerciseCounter('horizontal_push');
    const duration = 10 / rate;
    for (let i = 0; i <= Math.ceil(duration * 15); i++) {
      const t = i / 15;
      const angle = 130 + 45 * Math.cos(2 * Math.PI * rate * Math.min(t, duration));
      counter.update(frame('horizontal_push', angle, t * 1000));
    }
    expect(counter.snapshot().reps).toBeGreaterThanOrEqual(9);
    expect(counter.snapshot().reps).toBeLessThanOrEqual(11);
  });
  it('counts a shallow return as partial and starts the following full squat independently', () => {
    const counter = createExerciseCounter('squat');
    const shallow = [172, 150, 120, 120, 150, 172].map((angle, index) => frame('squat', angle, index * 150));
    for (const f of shallow) counter.update(f);
    expect(counter.snapshot()).toMatchObject({ reps: 0, partials: 1 });
    for (const f of cycle('squat', 172, 95, 900)) counter.update(f);
    expect(counter.snapshot()).toMatchObject({ reps: 1, partials: 1 });
  });
  it('keeps tracking the selected side across consecutive squats when visibility scores change', () => {
    const counter = createExerciseCounter('squat');
    const frames = [...cycle('squat', 172, 95, 0), ...cycle('squat', 172, 95, 900)];
    frames.forEach((f, index) => {
      for (const joint of patternSpec('squat').joints.left) f.landmarks[joint] = { ...f.landmarks[joint], visibility: index === 0 ? 0.7 : 1 };
      for (const joint of patternSpec('squat').joints.right) f.landmarks[joint] = { ...f.landmarks[joint], visibility: index === 0 ? 1 : 0.8 };
      counter.update(f);
    });
    expect(counter.snapshot().reps).toBe(2);
  });
  it('keeps completed repetitions but discards an interrupted movement when tracking is suspended', () => {
    const counter = createExerciseCounter('squat');
    for (const f of cycle('squat', 172, 95, 0)) counter.update(f);
    expect(counter.snapshot().reps).toBe(1);
    for (const f of [frame('squat', 172, 1000), frame('squat', 120, 1150), frame('squat', 95, 1300)]) counter.update(f);
    counter.suspend();
    expect(counter.snapshot().reps).toBe(1);
    for (const f of cycle('squat', 172, 95, 3000)) counter.update(f);
    expect(counter.snapshot().reps).toBe(2);
  });
  it('counts complete squat cycles and rejects an incomplete one', () => {
    const counter = createExerciseCounter('squat');
    let last = counter.snapshot();
    for (const f of cycle('squat', 172, 95, 0)) last = counter.update(f);
    expect(last.reps).toBe(1);
    // Descend and stop at the bottom without standing back up.
    for (const angle of [172, 140, 100, 95]) last = counter.update(frame('squat', angle, 1000 + angle));
    expect(last.reps).toBe(1);
    expect(last.rom).toBeGreaterThan(50);
  });

  it('does not count a repetition that never reaches the peak threshold', () => {
    const counter = createExerciseCounter('squat');
    let last = counter.snapshot();
    for (const [index, angle] of [172, 168, 160, 168, 172, 170].entries()) last = counter.update(frame('squat', angle, index * 200));
    expect(last.reps).toBe(0);
    expect(last.partials).toBeGreaterThanOrEqual(0);
  });

  it('counts each side separately for per-side patterns', () => {
    const counter = createExerciseCounter('curl');
    let last = counter.snapshot();
    for (const f of cycle('curl', 165, 45, 0, 120)) {
      // Move only the left arm; keep the right arm straight.
      setAngle(f.landmarks, patternSpec('curl').joints.right, 165);
      last = counter.update(f);
    }
    expect(last.leftReps).toBe(1);
    expect(last.rightReps).toBe(0);
    expect(last.reps).toBe(1);
  });

  it('counts a bilateral movement once even when both sides return together', () => {
    const counter = createExerciseCounter('squat');
    let last = counter.snapshot();
    for (const f of cycle('squat', 172, 95, 0)) last = counter.update(f);
    expect(last.reps).toBe(1);
  });

  it('treats a rep faster than the pattern minimum as not counted', () => {
    const counter = createExerciseCounter('curl');
    let last = counter.snapshot();
    for (const [i, angle] of [165, 60, 45, 45, 120, 165].entries()) {
      last = counter.update(frame('curl', angle, i * 20));
    }
    expect(last.reps).toBe(0);
  });

  it('preserves phase when the joints briefly leave the frame', () => {
    const counter = createExerciseCounter('squat');
    let last = counter.snapshot();
    last = counter.update(frame('squat', 172, 0));
    expect(last.phase).toBe('start');
    const hidden = frame('squat', 172, 100);
    for (const index of patternSpec('squat').joints.left) hidden.landmarks[index] = { ...hidden.landmarks[index], visibility: 0 };
    last = counter.update(hidden);
    last = counter.update({ ...hidden, timestamp: 900 });
    expect(last.visible).toBe(false);
    expect(last.phase).toBe('start');
  });

  it.each([1000, 2000, 4000])('handles a %i ms landmark gap without double counting', gap => {
    const counter = createExerciseCounter('squat');
    for (const f of cycle('squat', 172, 95, 0)) counter.update(f);
    for (const f of [frame('squat', 172, 1000), frame('squat', 130, 1150), frame('squat', 95, 1300), frame('squat', 95, 1450)]) counter.update(f);
    const before = counter.snapshot();
    const missing = frame('squat', 95, 1500);
    for (const p of missing.landmarks) p.visibility = 0;
    const during = counter.update({ ...missing, timestamp: 1450 + gap });
    expect(during.reps).toBe(1);
    expect(during.partials).toBe(before.partials);
    expect(during.phase).toBe('lost');
    counter.update(frame('squat', 172, 1500 + gap));
    expect(counter.snapshot().reps).toBe(gap > 3000 ? 1 : 2);
    counter.update(frame('squat', 172, 1650 + gap));
    expect(counter.snapshot().reps).toBe(gap > 3000 ? 1 : 2);
  });
});

describe('phases and range of motion', () => {
  it('reports the start, working, peak and return phases', () => {
    const frames = [
      frame('squat', 172, 0), frame('squat', 160, 100), frame('squat', 130, 200),
      frame('squat', 100, 300), frame('squat', 95, 450), frame('squat', 120, 600),
      frame('squat', 160, 700), frame('squat', 172, 850),
    ];
    const result = analyzeSequence('squat', frames);
    const phases = new Set(result.transitions.flatMap((entry) => [entry.from, entry.to]));
    expect(phases.has('start')).toBe(true);
    expect(phases.has('working')).toBe(true);
    expect(phases.has('peak')).toBe(true);
    expect(result.reps).toBe(1);
    expect(result.angleRange!.max - result.angleRange!.min).toBeGreaterThan(50);
  });

  it('uses a hold timer instead of repetitions for isometric patterns', () => {
    const frames = Array.from({ length: 8 }, (_, index) => holdAt(178, index * 1000));
    const result = analyzeSequence('core_isometric', frames);
    expect(result.holds).toBe(1);
    expect(result.reps).toBe(1);
    expect(result.holdMs).toBeGreaterThanOrEqual(5000);
  });

  it('breaks a hold when the posture drifts beyond tolerance', () => {
    const frames = [
      holdAt(178, 0), holdAt(178, 1000), holdAt(120, 1500),
      holdAt(178, 2000), holdAt(178, 3000), holdAt(120, 3500),
    ];
    const result = analyzeSequence('core_isometric', frames);
    // Each attempt lasts under the 5 s minimum and is broken by the drift frame.
    expect(result.holds).toBe(0);
  });
});

describe('form screening', () => {
  it('flags a knee that tracks inward in a front-view squat', () => {
    const landmarks = blank();
    setAngle(landmarks, patternSpec('squat').joints.left, 100, 0.5, 0.5);
    landmarks[25] = { ...landmarks[25], x: landmarks[27].x + 0.1 };
    const faults = screenForm(patternSpec('squat'), { landmarks, timestamp: 0, aspect: 1 }, 'front', 0.5);
    expect(faults.map((fault) => fault.rule)).toContain('knee_valgus');
  });

  it('does not apply a front-view rule to a side-view session', () => {
    const landmarks = blank();
    setAngle(landmarks, patternSpec('squat').joints.left, 100);
    landmarks[25] = { ...landmarks[25], x: landmarks[27].x + 0.1 };
    const faults = screenForm(patternSpec('squat'), { landmarks, timestamp: 0, aspect: 1 }, 'side', 0.5);
    expect(faults.map((fault) => fault.rule)).not.toContain('knee_valgus');
  });

  it('flags hips sagging out of the push-up line', () => {
    const landmarks = blank();
    setAngle(landmarks, [11, 23, 27], 120);
    const faults = screenForm(patternSpec('horizontal_push'), { landmarks, timestamp: 0, aspect: 1 }, 'side', 0.5);
    expect(faults.map((fault) => fault.rule)).toContain('body_line');
  });
});

describe('catalog-derived per-exercise overrides', () => {
  it('applies safe overrides and clamps malformed values', () => {
    const spec = resolvePatternSpec('squat', {
      mode: 'per_side', view: 'front', visibility: 0.01, minRom: 1,
      minRepMs: 1, maxRepMs: 999999, dwellMs: 9999,
    });
    expect(spec.mode).toBe('per_side');
    expect(spec.camera).toBe('front');
    expect(spec.visibility).toBe(0.2);
    expect(spec.minRom).toBe(5);
    expect(spec.minRepMs).toBe(200);
    expect(spec.maxRepMs).toBe(30000);
    expect(spec.dwellMs).toBe(500);
  });

  it('never turns a hold into a rep counter and clamps hold settings', () => {
    const spec = resolvePatternSpec('core_isometric', { mode: 'per_side', hold: { minHoldMs: 1, maxDriftDeg: 999 } });
    expect(spec.mode).toBe('hold');
    expect(spec.hold!.minHoldMs).toBe(1000);
    expect(spec.hold!.maxDriftDeg).toBe(45);
  });

  it('uses the override tempo instead of the family tempo', () => {
    const slow = [
      ...cycle('squat', 172, 95, 0, 300),
    ];
    expect(analyzeSequence('squat', slow).reps).toBe(1);
    expect(analyzeSequence('squat', slow, { override: { minRepMs: 2000 } }).reps).toBe(0);
  });
});

describe('live/upload consistency', () => {
  const interpolate = (frames: PoseFrame[], factor: number): PoseFrame[] => {
    const output: PoseFrame[] = [];
    const total = Math.round((frames.length - 1) * factor);
    for (let index = 0; index <= total; index += 1) {
      const position = index / factor;
      const low = Math.floor(position);
      const high = Math.min(frames.length - 1, low + 1);
      const ratio = position - low;
      const a = frames[low], b = frames[high];
      output.push({
        timestamp: a.timestamp + (b.timestamp - a.timestamp) * ratio,
        aspect: 1,
        landmarks: a.landmarks.map((landmark, i) => ({
          ...landmark,
          x: landmark.x + (b.landmarks[i].x - landmark.x) * ratio,
          y: landmark.y + (b.landmarks[i].y - landmark.y) * ratio,
        })),
      });
    }
    return output;
  };

  it('produces the same repetition count for the same movement at 10 fps and 15 fps', () => {
    const base = [
      ...cycle('squat', 172, 95, 0, 150),
      ...cycle('squat', 172, 95, 900, 150),
      ...cycle('squat', 172, 95, 1800, 150),
    ];
    const at10 = analyzeSequence('squat', base);
    const at15 = analyzeSequence('squat', interpolate(base, 1.5));
    expect(at10.reps).toBe(3);
    expect(at15.reps).toBe(at10.reps);
  });

  it('produces the same hold duration for the same posture at 5 fps and 10 fps', () => {
    const at5 = analyzeSequence('core_isometric', Array.from({ length: 9 }, (_, index) => holdAt(176, index * 1000)));
    const at10 = analyzeSequence('core_isometric', Array.from({ length: 17 }, (_, index) => holdAt(176, index * 500)));
    expect(at5.holds).toBe(1);
    expect(at10.holds).toBe(1);
    expect(Math.abs(at10.holdMs - at5.holdMs)).toBeLessThanOrEqual(500);
  });
});
