#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createReplayServer } from './server.mjs';
import { quantile, scoreReplay, memoryTrend } from './metrics.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const snapshotFiles=['shared/exerciseEngine.ts','shared/poseConfig.ts','shared/genericRepCounter.ts','shared/poseSubject.ts','shared/landmarkFilter.ts','shared/repCounter.ts',
  'mobile/poseStartGate.ts','mobile/poseCue.ts','mobile/poseSegments.ts','mobile/NativeTrackingCamera.tsx','mobile/PoseTrackerNative.tsx',
  'frontend/workers/pose.worker.ts','frontend/hooks/useGenericRepTracking.ts','frontend/hooks/useCameraStream.ts',
  'frontend/lib/trackingPerformance.mjs','frontend/sections/Coach/PoseTrackerSession.tsx','frontend/sections/Coach/GenericTrackingSession.tsx',
  'backend/src/pose-tracker/exercise-registry.ts','backend/src/pose-tracker/catalog-tracking.generated.ts','backend/src/pose-tracker/catalog-tiers.ts',
  'scripts/generate-exercise-coverage.mjs','package-lock.json','frontend/public/pose/pose_landmarker_lite.task',
  'frontend/public/pose/wasm/vision_wasm_internal.wasm','frontend/public/pose/wasm/vision_wasm_internal.js',
  'frontend/public/pose/wasm/vision_wasm_nosimd_internal.wasm','frontend/public/pose/wasm/vision_wasm_nosimd_internal.js',
  'scripts/pose-replay/browser.mjs','scripts/pose-replay/server.mjs','scripts/pose-replay/metrics.mjs','scripts/pose-replay/run.mjs'];

async function main() {
  const output=path.resolve(root,option('--output','output/pose-replay-private/baseline'));
  if(fs.existsSync(path.join(output,'provenance.json')))throw Error('Output already contains a run. Choose a fresh --output to preserve the baseline.');
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'.gitignore'),'*\n');
  const hashes={};
  for(const relative of snapshotFiles){const bytes=fs.readFileSync(path.join(root,relative));hashes[relative]=sha(bytes);const dest=path.join(output,'source',relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
  const provenance={startedAt:new Date().toISOString(),gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    dirtyStatus:execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'}),hashes,sourceFingerprint:sha(JSON.stringify(hashes)),
    runtime:{node:process.version,platform:process.platform,architecture:process.arch},
    instrumentation:'Read-only snapshot diagnostic fields injected in served exerciseEngine; disk source is unchanged. Worker/detector configuration is the app source.',
    mode:args.includes('--soak-minutes')?'wall-clock-browser-replay-soak':'offline-10hz-replay'};
  fs.writeFileSync(path.join(output,'provenance.json'),JSON.stringify(provenance,null,2));
  if(args.includes('--snapshot-only')){console.log(JSON.stringify({output,sourceFingerprint:provenance.sourceFingerprint,status:'snapshot-only-no-replay'}));return;}
  const manifestPath=path.resolve(root,option('--manifest','docs/pose-replay/labels.template.json'));
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  fs.copyFileSync(manifestPath,path.join(output,'labels.json'));
  const videoRoot=path.resolve(root,option('--videos','output/pose-replay-private/videos'));
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'ml/data/exercisedb_catalog.json'),'utf8'));
  const selected=manifest.clips.filter(clip=>!option('--clip')||clip.id===option('--clip'));
  if (!args.includes('--check') && !selected.length) throw Error('No matching clips; check --clip and manifest');
  if (args.includes('--soak-minutes') && !(Number(option('--soak-minutes')) > 0 && Number.isFinite(Number(option('--soak-minutes'))))) throw Error('--soak-minutes must be a positive finite number');
  const issues=selected.flatMap(clip=>[
    ...(!fs.existsSync(path.join(videoRoot,clip.fileName))?[`${clip.id}: video bytes missing`]:[]),
    ...(!clip.exerciseId||!catalog.some(row=>row.exerciseId===clip.exerciseId)?[`${clip.id}: select and confirm exact catalog exerciseId`]:[]),
    ...(clip.mappingConfirmed!==true?[`${clip.id}: mappingConfirmed must be true`]:[]),
  ]);
  if(!args.includes('--check') && issues.length){fs.writeFileSync(path.join(output,'blocked.json'),JSON.stringify({status:'blocked-no-replay',issues},null,2));console.log(JSON.stringify({output,status:'blocked-no-replay',issues},null,2));process.exitCode=2;return;}
  const server=createReplayServer(root,videoRoot);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const windows=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:option('--browser',process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||windows)});
    const page=await browser.newPage();
    page.on('pageerror',error=>console.error(`Replay page error: ${error.message}`));
    await page.goto(base);await page.waitForFunction(()=>window.replayReady===true);
    provenance.browser=browser.version();provenance.userAgent=await page.evaluate(()=>navigator.userAgent);
    fs.writeFileSync(path.join(output,'provenance.json'),JSON.stringify(provenance,null,2));
    if(args.includes('--check')){
      const result=await page.evaluate(()=>new Promise((resolve,reject)=>{const worker=new Worker('/frontend/workers/pose.worker.ts',{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(Error('Model startup timeout'));},30000);worker.onerror=event=>{clearTimeout(timer);worker.terminate();reject(Error(event.message));};worker.onmessage=event=>{clearTimeout(timer);worker.postMessage({type:'dispose'});worker.terminate();event.data.type==='ready'?resolve({status:'model-startup-passed',processedVideoFrames:0}):reject(Error(event.data.message));};worker.postMessage({type:'init',baseUrl:location.origin});}));
      fs.writeFileSync(path.join(output,'check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({output,...result}));return;
    }
    const summaries=[];
    let descriptor;
    await page.exposeFunction('emitPoseFrame',frame=>{fs.writeSync(descriptor,JSON.stringify(frame)+'\n');});
    for(const clip of selected){
      const videoFile=path.join(videoRoot,clip.fileName),videoSha256=sha(fs.readFileSync(videoFile));
      descriptor=fs.openSync(path.join(output,`${clip.id}.frames.jsonl`),'w');
      let summary;
      try {summary=await page.evaluate(options=>window.runPoseReplay(options),{clip,catalogExercise:catalog.find(row=>row.exerciseId===clip.exerciseId),mode:args.includes('--soak-minutes')?'soak':'offline',soakMs:Number(option('--soak-minutes','0'))*60000});}
      finally {fs.closeSync(descriptor);}
      summary.videoSha256=videoSha256;
      summary.inferenceP95Ms=quantile(summary.inferenceMs,.95);
      summary.bitmapInferenceDrawP95Ms=quantile(summary.bitmapInferenceDrawMs,.95);
      summary.memoryTrend=memoryTrend(summary.memory);
      summary.scoring=scoreReplay(summary,clip.labels);
      summary.validationStatus='not-validated';
      fs.writeFileSync(path.join(output,`${clip.id}.summary.json`),JSON.stringify(summary,null,2));summaries.push(summary);
      console.log(JSON.stringify({clip:clip.id,full:summary.fullReps,partial:summary.partialReps,scoring:summary.scoring.status,inferenceP95Ms:summary.inferenceP95Ms}));
    }
    fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({provenance,summaries},null,2));
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
