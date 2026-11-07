#!/usr/bin/env node
// Offline evaluation only. Does not access the network, camera, or application database.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createGenericRepCounter } from '../../shared/genericRepCounter.ts';

function matchEvents(predicted, labels) {
  const used = new Set(); let tp = 0;
  for (const timestamp of predicted) {
    const index = labels.findIndex((label, i) => !used.has(i) && timestamp >= label.startMs && timestamp <= label.endMs);
    if (index >= 0) { used.add(index); tp++; }
  }
  return {tp, fp:predicted.length-tp, fn:labels.length-tp};
}
const ratio = (a,b) => b ? a/b : null;
export function evaluate(recordings) {
  const groups = new Map();
  for (const recording of recordings) {
    if (!recording.exerciseId || !recording.config || !Array.isArray(recording.frames) || !Number.isInteger(recording.groundTruth?.reps) || !Array.isArray(recording.groundTruth.partialWindows) || !Array.isArray(recording.groundTruth.faultWindows)) throw Error('Invalid recording');
    const counter=createGenericRepCounter(recording.config); const partial=[],fault=[]; let time=0;
    counter.setEventCallback(event=>{if(event.type==='rep_partial')partial.push(time);if(event.type==='rep_rejected_fault')fault.push(time);});
    for(const frame of recording.frames) {time=frame.timestamp;counter.update(frame);}
    const count=counter.getProgress().repCount, error=Math.abs(count-recording.groundTruth.reps);
    const group=groups.get(recording.exerciseId) ?? {sets:0,absoluteError:0,withinOne:0,partial:{tp:0,fp:0,fn:0},fault:{tp:0,fp:0,fn:0}};
    group.sets++;group.absoluteError+=error;group.withinOne+=Number(error<=1);
    for(const [name,result] of [['partial',matchEvents(partial,recording.groundTruth.partialWindows)],['fault',matchEvents(fault,recording.groundTruth.faultWindows)]]) for(const key of ['tp','fp','fn']) group[name][key]+=result[key];
    groups.set(recording.exerciseId,group);
  }
  return [...groups].map(([exerciseId,g])=>({exerciseId,sets:g.sets,repCountMAE:g.absoluteError/g.sets,offByOneAccuracy:g.withinOne/g.sets,partial:{...g.partial,precision:ratio(g.partial.tp,g.partial.tp+g.partial.fp),recall:ratio(g.partial.tp,g.partial.tp+g.partial.fn)},fault:{...g.fault,precision:ratio(g.fault.tp,g.fault.tp+g.fault.fp),recall:ratio(g.fault.tp,g.fault.tp+g.fault.fn)},failsStartingTarget:g.withinOne!==g.sets}));
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if(process.env.POSE_EVAL_ENABLED!=='1' || process.argv.length<3) {process.stderr.write('Set POSE_EVAL_ENABLED=1 and supply local JSON recording files.\n');process.exitCode=1;}
  else {try {const inputs=process.argv.slice(2).map(path=>JSON.parse(fs.readFileSync(path,'utf8')));console.log(JSON.stringify({exercises:evaluate(inputs),note:'Exploratory results; use independent participants for the starting target.'},null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
}
