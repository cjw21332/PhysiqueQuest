// Local simulation only: saved selected landmarks, no model, camera, canvas or React.
// node --expose-gc scripts/pose-replay/landmark-soak.cjs [minutes]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { performance } = require('node:perf_hooks');
const root = process.cwd(), cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const requireLocal = name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name.endsWith('.ts') ? name : `${name}.ts`)) : require(name);
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: requireLocal, console }, { filename: file });
  return mod.exports;
}
const { createExerciseCounter } = load(path.join(root, 'shared/exerciseEngine.ts'));
const { createLandmarkFilter } = load(path.join(root, 'shared/landmarkFilter.ts'));
const { resolveTrackingConfig } = load(path.join(root, 'backend/src/pose-tracker/exercise-registry.ts'));
const { createTrackingTelemetry } = load(path.join(root, 'frontend/lib/trackingTelemetry.ts'));
const catalog = JSON.parse(fs.readFileSync('ml/data/exercisedb_catalog.json'));
const labels = JSON.parse(fs.readFileSync('patches/labels.local.json'));
const ids = ['c01','c06','c15','c17']; // development only, no held-out inputs
const clips = ids.map(id => {
  const entry = labels.find(x => x.clip_id === id);
  const exercise = catalog.find(x => x.exerciseId === entry.app_exercise_id);
  const config = resolveTrackingConfig(exercise);
  const file = `output/pose-replay-private/${id}-15hz-development/frames.jsonl`;
  return { id, config, exercise, frames: fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse) };
});
const minutes = Number(process.argv[2] || 30), fps = 15, minuteFrames = fps * 60;
const telemetryEnabled = process.argv.includes('--telemetry');
const telemetry = telemetryEnabled ? createTrackingTelemetry() : null;
const simulateBitmaps = process.argv.includes('--fake-bitmap');
let bitmapsCreated = 0, bitmapsClosed = 0;
const fakeWorker = { postMessage(bitmap) { bitmap.close(); } };
if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) throw Error('invalid duration');
const quantile = (arr, fraction) => { const sorted = [...arr].sort((a,b) => a-b); return sorted[Math.min(sorted.length-1, Math.ceil(sorted.length*fraction)-1)]; };
const windows = []; let switches = 0;
for (let minute = 0; minute < minutes; minute++) {
  const clip = clips[minute % clips.length], config = clip.config;
  const counter = createExerciseCounter(config.nativePattern, { override: config.nativeOverride, exerciseName: clip.exercise.name });
  const filter = createLandmarkFilter(true), samples = [], counterSamples = [], filterSamples = [];
  if (minute) switches++;
  for (let i = 0; i < minuteFrames; i++) {
    const source = clip.frames[i % clip.frames.length], t = (minute * minuteFrames + i) * 1000/fps + 1;
    const begin = performance.now();
    // Models the ownership handoff and release only, not native graphics memory.
    const bitmap = simulateBitmaps ? { closed: false, close() { if (this.closed) throw Error('bitmap closed twice'); this.closed = true; bitmapsClosed++; } } : null;
    if (bitmap) bitmapsCreated++;
    counter.update({landmarks: source.landmarks || [], timestamp: t, aspect: source.inputWidth / source.inputHeight});
    const afterCounter = performance.now();
    filter.update(source.landmarks || [], t);
    if (telemetry) telemetry.recordResult(t, 0, 0, 0);
    if (bitmap) fakeWorker.postMessage(bitmap);
    const end = performance.now();
    counterSamples.push(afterCounter-begin); filterSamples.push(end-afterCounter); samples.push(end-begin);
  }
  if (global.gc) global.gc();
  const mem = process.memoryUsage();
  windows.push({ minute: minute+1, clip: clip.id, frames: minuteFrames, p50Ms: quantile(samples,.5), p95Ms: quantile(samples,.95), p99Ms: quantile(samples,.99), maxMs: Math.max(...samples), counterP95Ms: quantile(counterSamples,.95), filterP95Ms: quantile(filterSamples,.95), overBudgetFrames: samples.filter(x=>x>1000/fps).length, heapUsed: mem.heapUsed, rss: mem.rss, external: mem.external, simulatedSwitches: switches, cameraRestarts: null });
}
const result = { description: 'Sequential unpaced CPU landmark counter/filter simulation. No live scheduler, model, camera, canvas or React. overBudgetFrames are not live dropped frames.', fps, minutes, telemetryEnabled, gcExposed: !!global.gc, simulateBitmaps, bitmapsCreated, bitmapsClosed, overlays: 'not present in current source; display filter only', windows };
const out = `output/pose-replay-private/landmark-soak-${telemetryEnabled ? 'telemetry-on' : 'telemetry-off'}${simulateBitmaps ? '-fake-bitmap' : ''}-${global.gc ? 'forced-gc' : 'normal-gc'}.json`; fs.writeFileSync(out, JSON.stringify(result,null,2));
console.log(JSON.stringify({out, first:windows[0], last:windows.at(-1), totalOverBudget:windows.reduce((n,x)=>n+x.overBudgetFrames,0)},null,2));
