// Read-only bridge to the CURRENT TypeScript engine; no counting logic is copied.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const readline = require('node:readline');
const ts = require(path.join(process.cwd(), 'node_modules/typescript'));
const root = process.cwd(), cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  let source = fs.readFileSync(file, 'utf8');
  if (file === path.join(root, 'shared/exerciseEngine.ts')) {
    const anchor = 'snapshot() { return counter.summary(); },';
    if (source.split(anchor).length !== 2) throw Error('Diagnostic anchor changed');
    source = source.replace(anchor, 'snapshot() { return {...counter.summary(), selectedSide:counter.bilateralSide, sideStates:counter.sides}; },');
  }
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const requireLocal = name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name.endsWith('.ts') ? name : `${name}.ts`)) : require(name);
  vm.runInNewContext(code, { module, exports: module.exports, require: requireLocal, console }, { filename: file });
  return module.exports;
}
const engine = load(path.join(root, 'shared/exerciseEngine.ts'));
const { createPoseSubjectSelector } = load(path.join(root, 'shared/poseSubject.ts'));
const { createLandmarkFilter } = load(path.join(root, 'shared/landmarkFilter.ts'));
const { resolveTrackingConfig } = load(path.join(root, 'backend/src/pose-tracker/exercise-registry.ts'));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'ml/data/exercisedb_catalog.json')));
let counter, spec, selector, filter, full = 0, partial = 0;
const previousCues = new Set();
readline.createInterface({ input: process.stdin }).on('line', line => {
  try {
    const message = JSON.parse(line);
    if (message.type === 'init') {
      const exercise = catalog.find(row => row.exerciseId === message.exerciseId);
      if (!exercise) throw Error('Unknown catalog exercise ID');
      const config = resolveTrackingConfig(exercise);
      if (!config.nativePattern) throw Error('No local pattern mapping; do not substitute a different pattern');
      spec = engine.resolvePatternSpec(config.nativePattern, config.nativeOverride);
      counter = engine.createExerciseCounter(config.nativePattern, { override: config.nativeOverride, exerciseName: exercise.name });
      selector = createPoseSubjectSelector(); filter = createLandmarkFilter(true);
      full = 0; partial = 0; previousCues.clear();
      console.log(JSON.stringify({ config, spec })); return;
    }
    if (!counter) throw Error('Initialize a confirmed exercise first');
    const selected = selector.select(message.poses);
    if (selected.changed) { counter.suspend(); filter.reset(); }
    const frame = { landmarks: selected.landmarks, timestamp: message.timestampMs, aspect: message.aspect };
    const snapshot = counter.update(frame), diagnostic = counter.snapshot();
    const repEvents = [];
    for (let i = full; i < snapshot.reps; i++) repEvents.push({ type: 'full', timestampMs: message.timestampMs });
    for (let i = partial; i < snapshot.partials; i++) repEvents.push({ type: 'partial', timestampMs: message.timestampMs });
    full = snapshot.reps; partial = snapshot.partials;
    const cues = snapshot.faults.filter(fault => !previousCues.has(fault.rule));
    previousCues.clear(); snapshot.faults.forEach(fault => previousCues.add(fault.rule));
    const leftAngle = engine.jointAngle(frame, spec.joints.left, spec.visibility);
    const rightAngle = engine.jointAngle(frame, spec.joints.right, spec.visibility);
    console.log(JSON.stringify({ timestampMs: message.timestampMs, landmarks: selected.landmarks,
      displayedLandmarks: filter.update(selected.landmarks, message.timestampMs), selectedSide: diagnostic.selectedSide,
      sideStates: diagnostic.sideStates, subjectChanged: selected.changed, leftAngle, rightAngle,
      missingWorkingTriplet: leftAngle === null && rightAngle === null, snapshot, repEvents, emittedFormCues: cues }));
  } catch (error) { console.log(JSON.stringify({ error: String(error.stack || error) })); }
});
