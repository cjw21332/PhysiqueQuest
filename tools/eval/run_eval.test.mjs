import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from './run_eval.mjs';
const config={primaryJoints:['left_knee'],sideMode:'unilateral',startAngles:{left_knee:150},peakAngles:{left_knee:90},directions:{left_knee:'decreasing'},referenceRanges:{left_knee:60},stabilityConstraints:[],viewHint:'side'};
test('evaluates two synthetic recordings and reports missed labels',()=>{
  const recording={exerciseId:'synthetic',config,frames:[],groundTruth:{reps:0,partialWindows:[],faultWindows:[]}};
  const [result]=evaluate([recording,{...recording,groundTruth:{reps:2,partialWindows:[{startMs:1,endMs:2}],faultWindows:[]}}]);
  assert.equal(result.sets,2);assert.equal(result.repCountMAE,1);assert.equal(result.offByOneAccuracy,0.5);assert.equal(result.partial.fn,1);assert.equal(result.partial.recall,0);assert.equal(result.failsStartingTarget,true);
});
