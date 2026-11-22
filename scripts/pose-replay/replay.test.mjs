import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { scoreReplay, quantile, memoryTrend } from './metrics.mjs';
import { createReplayServer } from './server.mjs';

test('missing or unreviewed labels never score a model output as ground truth',()=>{
  const summary={repEvents:[],cueEvents:[],durationMs:1000};
  assert.equal(scoreReplay(summary,null).sets,null);
  assert.equal(scoreReplay(summary,{reviewStatus:'unreviewed',sets:[]}).falseCueCount,null);
});
test('full and partial errors are independent and false cues require rule/time annotations',()=>{
  const summary={repEvents:[{type:'full',timestampMs:500},{type:'partial',timestampMs:800}],cueEvents:[{rule:'body_line',timestampMs:700}],durationMs:60000};
  const labels={reviewStatus:'reviewed',reviewedBy:'test-only',sets:[{id:'s1',startMs:0,endMs:1000,fullReps:1,partialReps:2}],cueCoverageComplete:true,formIntervals:[]};
  let scored=scoreReplay(summary,labels);
  assert.equal(scored.sets[0].fullError,0);assert.equal(scored.sets[0].partialError,-1);assert.equal(scored.falseCueCount,null);
  scored=scoreReplay(summary,{...labels,formIntervals:[{rule:'body_line',startMs:0,endMs:1000,faultPresent:false}]});
  assert.equal(scored.falseCueCount,1);assert.equal(scored.falseCueRatePerMinute,1);
});
test('latency and memory statistics preserve missing values and exclude warmup',()=>{
  assert.equal(quantile([],.95),null);assert.equal(quantile([1,3,2],.95),3);
  assert.equal(memoryTrend([]).growthMiB,null);
  const trend=memoryTrend([{elapsedMs:0,jsHeapBytes:1e9},{elapsedMs:300000,jsHeapBytes:1048576},{elapsedMs:360000,jsHeapBytes:2097152}]);
  assert.equal(trend.growthMiB,1);assert.equal(trend.slopeMiBPerMinute,1);
});
test('replay server serves the actual worker and instruments diagnostics without modifying source',async()=>{
  const root=process.cwd(),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'pq-replay-http-'));
  const enginePath=path.join(root,'shared/exerciseEngine.ts'),original=fs.readFileSync(enginePath,'utf8');
  fs.writeFileSync(path.join(temporary,'range.mp4'),'0123456789');
  const server=createReplayServer(root,temporary);
  const request=(url,headers={})=>new Promise((resolve,reject)=>{
    const chunks=[];
    const response=new Writable({write(chunk,encoding,done){chunks.push(Buffer.from(chunk));done();}});
    response.statusCode=200;response.setHeader=()=>{};response.writeHead=status=>{response.statusCode=status;};
    response.on('finish',()=>resolve({status:response.statusCode,text:Buffer.concat(chunks).toString()}));response.on('error',reject);
    server.emit('request',{url,headers},response);
  });
  try{
    const worker=(await request('/frontend/workers/pose.worker.ts')).text;
    assert.match(worker,/from "\/mediapipe.mjs"/);assert.match(worker,/poseSubject.ts/);
    const engine=(await request('/shared/exerciseEngine.ts')).text;
    assert.match(engine,/replayDiagnostics/);assert.equal(fs.readFileSync(enginePath,'utf8'),original);
    const range=await request('/videos/range.mp4',{range:'bytes=2-5'});
    assert.equal(range.status,206);assert.equal(range.text,'2345');
  }finally{fs.unlinkSync(path.join(temporary,'range.mp4'));fs.rmdirSync(temporary);}
});
