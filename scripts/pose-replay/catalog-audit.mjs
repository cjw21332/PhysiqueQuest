#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const cache=new Map();
function load(file){
  if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const localRequire=name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name.endsWith('.ts')?name:`${name}.ts`)):createRequire(file)(name);
  vm.runInNewContext(code,{module,exports:module.exports,require:localRequire,console},{filename:file});return module.exports;
}
const {SPECS,LM}=load(path.join(root,'shared/poseConfig.ts'));
const {resolveTrackingConfig}=load(path.join(root,'backend/src/pose-tracker/exercise-registry.ts'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'ml/data/exercisedb_catalog.json'),'utf8'));
if(catalog.length!==1500||new Set(catalog.map(row=>row.exerciseId)).size!==1500)throw Error('Catalog must contain exactly 1500 unique IDs');
const landmarkNames=Object.fromEntries(Object.entries(LM).map(([name,index])=>[index,name]));
const records=catalog.map(row=>{
  const config=resolveTrackingConfig(row),spec=SPECS[config.nativePattern];
  return {exerciseId:row.exerciseId,name:row.name,pattern:config.nativePattern??null,
    classification:config.nativeSupport??'UNSUPPORTED',requiredTriplets:spec?spec.joints:null,
    requiredJointNames:spec?Object.fromEntries(Object.entries(spec.joints).map(([side,joints])=>[side,joints.map(index=>landmarkNames[index])])):null,
    startupRequirement:spec?'one complete visible working triplet; current gate thresholds and dwell apply':'no supported local gate',
    recommendedCameraView:spec?(config.nativeOverride?.view??spec.camera):null,acceptableCameraAngles:'not replay-established',
    override:config.nativeOverride??null,replayValidated:false,replayEvidenceClips:0};
});
const counts=records.reduce((out,row)=>(out[row.classification]=(out[row.classification]??0)+1,out),{});
const output=path.join(root,'docs/pose-replay/catalog-current.json');
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,status:'current-configuration-audit-no-promotions',catalogSize:1500,counts,validated:0,
  note:'Working triplets and recommended views are configuration, not demonstrated camera-angle tolerance. No mappings or tiers were changed.',records},null,2)+'\n');
const manifestPath=path.join(root,'docs/pose-replay/labels.template.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const normalized=name=>name.toLowerCase().replace(/\.(mp4|mov)$/,'').replace(/\b(2nd|3rd) try\b/g,'').replace(/\(regular one\)/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const words=name=>normalized(name).split(' ').filter(word=>!['try','2nd','3rd','regular','one'].includes(word));
for(const clip of manifest.clips){
  const tokens=words(clip.fileName);
  clip.catalogCandidates=records.map(row=>({row,score:normalized(row.name)===normalized(clip.fileName)?100:tokens.filter(token=>words(row.name).includes(token)).length/tokens.length})).filter(match=>match.score>=.75)
    .sort((a,b)=>b.score-a.score||a.row.name.length-b.row.name.length).slice(0,6).map(({row})=>({exerciseId:row.exerciseId,name:row.name,pattern:row.pattern}));
}
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,catalogSize:records.length,counts,validated:0,clips:manifest.clips.length}));
