import { describe, expect, it } from 'vitest';
import { GenericRepCounter, type GeneratedAngleConfig, type Landmark } from '../genericRepCounter';

// Synthetic software fixtures; angles are not camera or biomechanical measurements.
const cfg = (start: number, peak: number): GeneratedAngleConfig => ({
  primaryJoints: ['left_knee', 'right_knee'], sideMode: 'bilateral',
  startAngles: { left_knee: start, right_knee: start }, peakAngles: { left_knee: peak, right_knee: peak },
  directions: { left_knee: 'decreasing', right_knee: 'decreasing' }, referenceRanges: { left_knee: start - peak, right_knee: start - peak },
  stabilityConstraints: [], viewHint: 'side',
});
function landmarks(angle: number, visibility = 1): Landmark[] {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility, presence: visibility }));
  for (const side of [0, 1]) {
    const x = side ? 0.7 : 0.3, r = angle * Math.PI / 180;
    p[23 + side] = { ...p[23 + side], x: x + 0.15, y: 0.5 };
    p[25 + side] = { ...p[25 + side], x, y: 0.5 };
    p[27 + side] = { ...p[27 + side], x: x + 0.15 * Math.cos(r), y: 0.5 + 0.15 * Math.sin(r) };
  }
  return p;
}
function send(c: GenericRepCounter, angle: number, timestamp: number, visibility = 1) {
  const points = landmarks(angle, visibility);
  const actual = (c as any).computeBilateralAngle(points, 1);
  if (visibility) expect(actual).toBeCloseTo(angle, 5); else expect(actual).toBeNull();
  return c.update({ landmarks: points, timestamp, aspect: 1 });
}

describe('calibration lifecycle (synthetic)', () => {
  it('does not accept a 20-degree observed span merely because endpoint clamping expands it', () => {
    const c = new GenericRepCounter(cfg(160,80), { emaAlpha: 1, calibrationWarmupMs: 0 });
    for (const [a,t] of [[160,100],[140,200],[140,300],[140,400],[160,500]] as const) send(c,a,t);
    expect((c as any).calibratedRest).toBeNull();
    expect((c as any).calibratedPeak).toBeNull();
  });
  it('starts sampling at warmup boundary and needs five valid samples and sufficient range', () => {
    const c = new GenericRepCounter(cfg(160, 80), { emaAlpha: 1 });
    send(c, 160, 100); send(c, 80, 3099);
    expect((c as any).calibrationSamples).toHaveLength(0);
    for (const [a,t] of [[160,3100],[140,3200],[120,3300],[100,3400]] as const) send(c,a,t);
    expect((c as any).calibrationSamples).toHaveLength(4); expect((c as any).calibratedRest).toBeNull();
    send(c,80,3500);
    expect((c as any).calibrationSamples).toHaveLength(5);
    expect((c as any).calibratedRest).toBeCloseTo(160, 5); expect((c as any).calibratedPeak).toBeCloseTo(80, 5);
  });
  it('does not collect missing landmarks and clears calibration after prolonged loss', () => {
    const c = new GenericRepCounter(cfg(160,80), { emaAlpha: 1, calibrationWarmupMs: 0 });
    for (const [a,t] of [[160,100],[140,200],[120,300],[100,400],[80,500]] as const) send(c,a,t);
    expect((c as any).calibratedRest).not.toBeNull();
    send(c,80,600,0); expect((c as any).calibrationSamples).toHaveLength(5);
    send(c,80,1101,0); expect((c as any).calibratedRest).toBeNull();
    send(c,160,1200); expect((c as any).calibrationSamples).toHaveLength(1);
    c.resetSession(); expect((c as any).calibrationSamples).toHaveLength(0); expect((c as any).sessionStartMs).toBeNull();
  });
  it('characterizes invalid initial frames consuming the current warmup clock', () => {
    const c = new GenericRepCounter(cfg(160, 80), { emaAlpha: 1 });
    send(c,160,100,0); send(c,160,3000,0); send(c,160,3100);
    expect((c as any).sessionStartMs).toBe(100);
    expect((c as any).calibrationSamples).toHaveLength(1);
  });
  it('characterizes immediate acceptance while a repetition is active', () => {
    const c = new GenericRepCounter(cfg(160,80), { emaAlpha: 1, calibrationWarmupMs: 0 });
    for (const [a,t] of [[160,100],[140,200],[120,300],[100,400]] as const) send(c,a,t);
    expect(c.getProgress().state).toBe('MOVING'); expect((c as any).calibratedRest).toBeNull();
    send(c,80,500);
    expect((c as any).calibratedRest).not.toBeNull();
    expect(c.getProgress().state).toBe('AT_PEAK');
  });
  it('records the five existing failure sequences without changing their assertions', () => {
    const cases: Array<[string, number, number, number[], number | undefined]> = [
      ['rest',170,90,[...Array(11).fill(140), ...Array(5).fill([140,135,125,115,105,95,85,80,80,85,95,105,115,125,135,140,140,140,140]).flat()],undefined],
      ['140',170,90,Array(3).fill([140,125,110,95,80,95,110,125,140,140]).flat(),1],
      ['shallow',160,60,Array(3).fill([160,150,140,130,120,110,100,110,120,130,140,150,160,160]).flat(),1],
      ['mixed',160,80,[80,80,110,80].flatMap(p => [160,140,120,p,p,120,140,160,160]),1],
      ['shift',160,80,[...Array(2).fill([160,140,120,100,80,80,100,120,140,160,160]).flat(),...Array(15).fill(140),...Array(10).fill(160)],1],
    ];
    for (const [name,start,peak,sequence,alpha] of cases) {
      const c = new GenericRepCounter(cfg(start,peak), alpha === undefined ? {} : { emaAlpha: alpha });
      const events: string[] = []; let frameEvents: string[] = [];
      c.setEventCallback((e: any) => { const label = e.type === 'state_change' ? `${e.from}>${e.to}` : e.type; events.push(label); frameEvents.push(label); });
      let last = '', changes: string[] = [];
      sequence.forEach((a,i) => {
        const t = (i+1)*100; frameEvents = []; send(c,a,t);
        const raw = c as any; const key = `${raw.calibratedRest?.toFixed(1) ?? '-'}:${raw.calibratedPeak?.toFixed(1) ?? '-'}`;
        if (process.env.POSE_CALIBRATION_TRACE === '1' && name !== 'shift') {
          const progress = c.getProgress();
          console.log(JSON.stringify({case:name,timestamp:t,rawAngle:(c as any).computeBilateralAngle(landmarks(a),1),smoothedAngle:progress.currentAngle,samples:raw.calibrationSamples.length,warmupComplete:t-raw.sessionStartMs>=raw.config.calibrationWarmupMs,calibratedStart:raw.calibratedRest,calibratedPeak:raw.calibratedPeak,state:progress.state,progress:progress.currentProgress,observedRom:Number.isFinite(raw.observedMax-raw.observedMin)?raw.observedMax-raw.observedMin:null,events:frameEvents,full:progress.repCount,partial:progress.partialCount}));
        }
        if (key !== last) { changes.push(`${t}ms=${key},n=${raw.calibrationSamples.length},state=${c.getProgress().state}`); last = key; }
      });
      const raw = c as any; const values = raw.calibrationSamples.map((s: any) => s.angle);
      console.log(JSON.stringify({ name, duration: sequence.length*100, initialWarmupEnd: 3100, samples: values.length, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null, calibration: changes, events, result: c.getProgress() }));
    }
    expect(cases).toHaveLength(5);
  });
});
