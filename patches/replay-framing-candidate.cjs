// Reprocess saved selected landmarks without running inference. This is a
// diagnostic of native framing/start-gate behavior, not a full phone replay.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require(path.resolve('node_modules/typescript'));
const root = process.cwd(), cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = {exports:{}}; cache.set(file,module);
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const req = name => name.startsWith('.') ? load(path.resolve(path.dirname(file),name.endsWith('.ts') ? name : `${name}.ts`)) : require(name);
  vm.runInNewContext(code,{module,exports:module.exports,require:req,console},{filename:file});
  return module.exports;
}
const eng = load(path.join(root,'shared/exerciseEngine.ts'));
const gateMod = load(path.join(root,'mobile/poseStartGate.ts'));
const framingMod = load(path.join(root,'shared/framingGuard.ts'));
const filterMod = load(path.join(root,'shared/landmarkFilter.ts'));
const registry = load(path.join(root,'backend/src/pose-tracker/exercise-registry.ts'));
const catalog = JSON.parse(fs.readFileSync(path.join(root,'ml/data/exercisedb_catalog.json')));
const labels = JSON.parse(fs.readFileSync(path.join(root,'patches/labels.local.json')));
const prefix = path.join(root,'output/pose-replay-private/provisional-baseline-2026-11-21');
const result = [];
for (const id of ['c01','c06','c15','c17']) {
  const label=labels.find(x=>x.clip_id===id), exercise=catalog.find(x=>x.exerciseId===label.app_exercise_id);
  const config=registry.resolveTrackingConfig(exercise), gate=gateMod.createPoseStartGate(), filter=filterMod.createLandmarkFilter(true), framing=framingMod.createFramingGuard();
  const counter=eng.createExerciseCounter(config.nativePattern,{override:config.nativeOverride,exerciseName:exercise.name});
  const lines=fs.readFileSync(path.join(prefix,id,'frames.jsonl'),'utf8').trim().split('\n');
  let counting=false, start=null, prev={reps:0,partials:0}, events=[];
  for (const line of lines) {
    const r=JSON.parse(line), raw=r.landmarks, t=r.timestampMs;
    let next;
    if (!Array.isArray(raw) || raw.length<33) {
      if(framing.update(t,false).suspend) counter.suspend(); const g=gate.update(t,false); if(counting && !g.active){counter.suspend(); counting=false;}
      continue;
    }
    const filtered=filter.update(raw,t);
    const ok=gateMod.frameStatus(config.nativePattern,filtered)==='OK';
    if (!ok) {
      const g=gate.update(t,false); if(counting && !g.active){counter.suspend(); counting=false;}
      if(framing.update(t,false).suspend) counter.suspend(); continue;
    } else {
      if(framing.update(t,true).suspend) counter.suspend();
      const g=gate.update(t,true);
      if (!g.active) {if(counting){counter.suspend();counting=false;} continue;}
      if (!counting && start===null) start=t;
      counting=true; next=counter.update({landmarks:raw,timestamp:t,aspect:r.inputWidth/r.inputHeight});
    }
    if(next.reps>prev.reps || next.partials>prev.partials) events.push({timestampMs:t,full:next.reps-prev.reps,partial:next.partials-prev.partials,framingOk:ok});
    prev=next;
  }
  result.push({clip:id, firstGateActiveMs:start, snapshot:counter.snapshot(),events});
}
const out=path.join(root,'patches/framing-guard-development-diagnostic.json');
fs.writeFileSync(out,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
