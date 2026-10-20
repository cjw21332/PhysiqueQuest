import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../../shared/cameraReadiness.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { readinessPolicy, validateReadinessObservation, evaluateReadiness, createReadinessController, projectReadinessPoint } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const policy = { ...readinessPolicy, calibrated: { web: { fullBody: true, lighting: true, framing: true }, native: { fullBody: true, lighting: true, framing: true } }, lightingBand: [0.2, 0.8] };
function observation(overrides = {}) {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.15, visibility: 0.95 }));
  for (const [indices, y] of [[[11,12],.3],[[13,14],.4],[[15,16],.5],[[23,24],.5],[[25,26],.7],[[27,28,29,30,31,32],.9]]) {
    for (const index of indices) landmarks[index] = { x: index % 2 ? .4 : .6, y, visibility: .95 };
  }
  return { platform: 'web', sessionId: 'session-1', frameId: 1, receivedAt: 0, sourceWidth: 600, sourceHeight: 1000, previewWidth: 600, previewHeight: 1000, geometryGeneration: 1, coordinatesMirrored: false, previewMirrored: false, poseCount: 1, landmarks, luminance: .5, ...overrides };
}
test('calibration remains false and normal use cannot pass body brightness or framing', () => {
  const result = evaluateReadiness(observation());
  for (const key of ['fullBody','lighting','framing']) assert.equal(result[key].reason, 'uncalibrated');
});
test('complete body gives independent synthetic evidence; zero person still allows brightness', () => {
  const result = evaluateReadiness(observation(), policy);
  assert.equal(result.fullBody.status, 'ready'); assert.equal(result.framing.status, 'ready'); assert.equal(result.lighting.status, 'ready');
  const none = evaluateReadiness(observation({ poseCount: 0, landmarks: [] }), policy);
  assert.equal(none.fullBody.status, 'unknown'); assert.equal(none.framing.status, 'unknown'); assert.equal(none.lighting.status, 'ready');
});
test('head hand foot and bilateral missing/uncertain evidence cannot pass', () => {
  for (const index of [0,11,12,13,14,15,16,23,24,25,26,27,28,29,30,31,32]) {
    for (const confidence of [undefined, .1, NaN]) {
      const frame = observation(); frame.landmarks[index].visibility = confidence;
      assert.equal(evaluateReadiness(frame, policy).fullBody.status, 'unknown', `${index} ${confidence}`);
      assert.notEqual(evaluateReadiness(frame, policy).framing.reason, 'too-small');
    }
    const frame = observation(); frame.landmarks[index].x = -.1;
    assert.equal(evaluateReadiness(frame, policy).fullBody.reason, 'clipped');
  }
});
test('bounds and malformed evidence reject without guessing confidence', () => {
  for (const change of [ {sourceWidth:0}, {sourceHeight:Infinity}, {previewWidth:NaN}, {frameId:1.5}, {receivedAt:NaN}, {sessionId:''}, {sessionId:'x'.repeat(129)}, {poseCount:2}, {landmarks:Array(34).fill({x:.5,y:.5})}, {landmarks:Array(33)}, {coordinatesMirrored:undefined} ]) assert.equal(validateReadinessObservation(observation(change)), false);
  for (const change of [{x:NaN},{y:Infinity},{visibility:1.1},{presence:-.1}]) {
    const frame=observation(); Object.assign(frame.landmarks[15], change); assert.equal(validateReadinessObservation(frame), false);
  }
  const frame=observation(); frame.landmarks[15].presence=.1; assert.equal(evaluateReadiness(frame,policy).fullBody.status,'unknown');
});
test('cover crop, portrait/landscape and a single mirror match visible coordinates', () => {
  const frame = observation({ sourceWidth:1000, sourceHeight:600, previewWidth:300, previewHeight:600 });
  assert.equal(evaluateReadiness(frame,policy).fullBody.status,'ready');
  frame.landmarks[15].x=.1; assert.equal(evaluateReadiness(frame,policy).fullBody.reason,'clipped');
  assert.deepEqual(projectReadinessPoint({x:.2,y:.4}, observation({previewMirrored:true})), {x:.8,y:.4});
  assert.deepEqual(projectReadinessPoint({x:.2,y:.4}, observation({previewMirrored:true, coordinatesMirrored:true})), {x:.2,y:.4});
  assert.equal(projectReadinessPoint({x:.5,y:.5}, frame).x,.5);
});
test('small whole upright body may request closer; bent ambiguous body never does', () => {
  const frame=observation(); frame.landmarks.forEach(p=>p.y=.3+p.y*.4);
  assert.equal(evaluateReadiness(frame,policy).framing.reason,'too-small');
  frame.landmarks[25].x=.8;
  assert.equal(evaluateReadiness(frame,policy).framing.status,'unknown');
  frame.landmarks[25].visibility=.1;
  assert.notEqual(evaluateReadiness(frame,policy).framing.reason,'too-small');
});
test('brightness limits are inclusive and invalid sampling affects lighting only', () => {
  for (const luminance of [.2,.8]) assert.equal(evaluateReadiness(observation({luminance}),policy).lighting.status,'ready');
  for (const luminance of [undefined,NaN,-.1,1.1]) {
    const result=evaluateReadiness(observation({luminance}),policy);
    assert.equal(result.lighting.status,'unknown'); assert.equal(result.fullBody.status,'ready');
  }
});
test('fake clock dwell needs advancing frames and duplicate input cannot extend expiry', () => {
  const controller=createReadinessController(policy); controller.reset('session-1',1);
  for(let i=0;i<=5;i++) { controller.frame({sessionId:'session-1',frameId:i,receivedAt:i*200}); controller.observe(observation({frameId:i,receivedAt:i*200}),i*200); }
  assert.equal(controller.snapshot().connection.status,'ready'); assert.equal(controller.snapshot().fullBody.status,'ready');
  controller.observe(observation({frameId:5,receivedAt:2200}),2200);
  assert.equal(controller.expire(2251).fullBody.status,'unknown');
  assert.equal(controller.snapshot().connection.status,'unknown');
});
test('generation change late reply invalid evidence and backwards clock clear affected passes', () => {
  const controller=createReadinessController({...policy,dwellMs:0}); controller.reset('session-1',1);
  controller.frame({sessionId:'session-1',frameId:1,receivedAt:0}); controller.observe(observation(),0);
  assert.equal(controller.snapshot().fullBody.status,'ready');
  controller.observe(observation({frameId:2,landmarks:[]}),1); assert.equal(controller.snapshot().fullBody.status,'unknown');
  controller.reset('session-2',2); controller.observe(observation({frameId:99,receivedAt:10}),10);
  assert.equal(controller.snapshot().fullBody.status,'unknown');
  controller.observe(observation({sessionId:'session-2',geometryGeneration:1,frameId:100,receivedAt:10}),10);
  assert.equal(controller.snapshot().localObservations,0);
});
test('new generation waits for evidence only within its initial freshness window', () => {
  const controller=createReadinessController(policy); controller.reset('waiting',1,'pending',5000);
  assert.equal(controller.expire(5100).connection.reason,'pending');
  assert.equal(controller.expire(6251).connection.reason,'stale');
  assert.notEqual(controller.snapshot().connection.status,'ready');
});
