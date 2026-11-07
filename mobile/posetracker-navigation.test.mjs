import test from 'node:test';
import assert from 'node:assert/strict';
import {isTrustedWebViewNavigation,isTrustedWebViewUrl} from './connection.mjs';
test('PoseTracker tracking URL is allowed only as a subframe and never as a native bridge source',()=>{
  const app='https://physique.example',provider='https://app.posetracker.com/pose_tracker/tracking?token=test';
  assert.equal(isTrustedWebViewNavigation(provider,app,false),true);
  for(const top of [true,undefined])assert.equal(isTrustedWebViewNavigation(provider,app,top),false);
  for(const url of ['https://app.posetracker.com/account','https://app.posetracker.com.evil.test/pose_tracker/tracking','https://user:pass@app.posetracker.com/pose_tracker/tracking'])assert.equal(isTrustedWebViewNavigation(url,app,false),false);
  assert.equal(isTrustedWebViewUrl(provider,app),false);
  assert.equal(isTrustedWebViewNavigation(app+'/coach',app,true),true);
});
