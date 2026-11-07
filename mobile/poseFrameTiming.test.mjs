import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrameDelay, poseIsFresh } from './poseFrameTiming.mjs';
test('frame scheduling waits only for the remainder of the target interval',()=>{assert.equal(nextFrameDelay(1000,1030),70);assert.equal(nextFrameDelay(1000,1200),0);assert.equal(nextFrameDelay(NaN,1000),100);});
test('old, reversed and invalid timestamps cannot be shown as live tracking',()=>{assert.equal(poseIsFresh(1000,2499),true);assert.equal(poseIsFresh(1000,2501),false);assert.equal(poseIsFresh(1000,999),false);assert.equal(poseIsFresh(NaN,1000),false);});
