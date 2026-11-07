import test from 'node:test';
import assert from 'node:assert/strict';
import { trackingFrameInterval, trackingPowerNotice } from '../lib/trackingPerformance.mjs';

test('reduces frame rate for a low discharging battery but restores it when charging',()=>{
  assert.equal(trackingFrameInterval(25,{level:.5,charging:false}),100);
  assert.equal(trackingFrameInterval(25,{level:.2,charging:false}),250);
  assert.equal(trackingFrameInterval(25,{level:.1,charging:false}),500);
  assert.equal(trackingFrameInterval(25,{level:.1,charging:true}),100);
  assert.match(trackingPowerNotice({level:.1,charging:false}),/Low battery/);
});
test('slow inference adapts without fabricating battery or temperature information',()=>{
  assert.equal(trackingFrameInterval(180,null),360);
  assert.equal(trackingFrameInterval(1000,null),500);
  assert.equal(trackingFrameInterval(NaN,null),100);
  assert.equal(trackingPowerNotice(null),'Battery status unavailable on this device.');
  assert.equal(trackingPowerNotice({level:NaN,charging:false}),'Battery status unavailable on this device.');
});
