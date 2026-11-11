#!/usr/bin/env node
// JSON input: {landmarks: T x 33 x 4, timestamps: T (ms), aspect, angleConfig, counterConfig?}.
// landmarks may instead be the path to a little-endian float32/float64 .npy array.
import fs from 'node:fs';
import path from 'node:path';
import { GenericRepCounter } from '../../shared/genericRepCounter.ts';

function readNpy(filename) {
  const buf = fs.readFileSync(filename);
  if (buf.subarray(0, 6).toString('latin1') !== '\x93NUMPY') throw new Error('Not an NPY file');
  const major = buf[6];
  if (![1, 2, 3].includes(major)) throw new Error('Unsupported NPY version');
  const headerLength = major === 1 ? buf.readUInt16LE(8) : buf.readUInt32LE(8);
  const offset = (major === 1 ? 10 : 12) + headerLength;
  const header = buf.subarray(major === 1 ? 10 : 12, offset).toString('latin1');
  const dtype = /['"]descr['"]\s*:\s*['"]([^'"]+)/.exec(header)?.[1];
  const shape = /['"]shape['"]\s*:\s*\(([^)]*)\)/.exec(header)?.[1]?.split(',').map(x => x.trim()).filter(Boolean).map(Number);
  if (!shape || shape.length !== 3 || shape[1] !== 33 || shape[2] !== 4 || !['<f4', '<f8', '|f4', '|f8'].includes(dtype) || /['"]fortran_order['"]\s*:\s*True/.test(header)) throw new Error('NPY must be C-order little-endian float32/float64 with shape (T,33,4)');
  const size = dtype.endsWith('4') ? 4 : 8;
  if (buf.length !== offset + shape[0] * 33 * 4 * size) throw new Error('NPY size does not match shape');
  let i = offset;
  return Array.from({ length: shape[0] }, () => Array.from({ length: 33 }, () => Array.from({ length: 4 }, () => { const value = size === 4 ? buf.readFloatLE(i) : buf.readDoubleLE(i); i += size; return value; })));
}

try {
  const inputPath = process.argv[2];
  const input = JSON.parse(inputPath && inputPath !== '-' ? fs.readFileSync(inputPath, 'utf8') : fs.readFileSync(0, 'utf8'));
  const landmarks = typeof input.landmarks === 'string' ? readNpy(path.resolve(inputPath && inputPath !== '-' ? path.dirname(inputPath) : process.cwd(), input.landmarks)) : input.landmarks;
  if (!Array.isArray(landmarks) || !Array.isArray(input.timestamps) || landmarks.length !== input.timestamps.length || !Number.isFinite(input.aspect) || input.aspect <= 0 || !input.angleConfig) throw new Error('Expected landmarks, matching timestamps, positive aspect and angleConfig');
  const counter = new GenericRepCounter(input.angleConfig, input.counterConfig ?? {});
  const events = [];
  counter.setEventCallback(event => events.push(event));
  const trace = [];
  const smoothedAngles = landmarks.map((frame, i) => {
    if (!Array.isArray(frame) || frame.length !== 33 || !frame.every(point => Array.isArray(point) && point.length >= 4 && point.slice(0, 4).every(Number.isFinite)) || !Number.isFinite(input.timestamps[i]) || (i && input.timestamps[i] <= input.timestamps[i - 1])) throw new Error(`Invalid frame or timestamp at ${i}`);
    const points = frame.map(([x, y, z, visibility]) => ({ x, y, z, visibility, presence: visibility }));
    const firstEvent = events.length;
    const progress = counter.update({ landmarks: points, timestamp: input.timestamps[i], aspect: input.aspect });
    if (input.trace) trace.push({ frame: i, timestamp: input.timestamps[i], state: progress.state, progress: progress.currentProgress, angle: progress.currentAngle, count: progress.repCount, calibratedRest: counter.calibratedRest, calibratedPeak: counter.calibratedPeak, calibrationReps: counter.calibrationReps, events: events.slice(firstEvent) });
    return progress.currentAngle;
  });
  const progress = counter.getProgress();
  process.stdout.write(JSON.stringify({ count: progress.repCount, partialCount: progress.partialCount, holdDurationMs: progress.holdDurationMs, reps: events.filter(event => event.type === 'rep_counted'), events, smoothedAngles, ...(input.trace ? { trace } : {}) }) + '\n');
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
