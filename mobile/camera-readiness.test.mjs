import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(path,dependencies={},globals={}) {
  const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source,{exports:module.exports,module,require:name=>{
    if(name in dependencies)return dependencies[name];
    throw new Error(`Unexpected import ${name}`);
  },performance:{now:()=>0},setTimeout,clearTimeout,console,...globals},{filename:path});
  return module.exports;
}
const shared=compile('shared/cameraReadiness.ts');
const recoveryModule=compile('shared/cameraRecovery.ts');
const rep=compile('shared/repCounter.ts');
const poseConfig=compile('shared/poseConfig.ts');
const poseSubject=compile('shared/poseSubject.ts');
function nativeModule({available=true,react={},asset={downloadAsync:()=>Promise.resolve({localUri:'local-model'})},listeners=[],globals={}}={}) {
  return compile('mobile/NativeTrackingCamera.tsx',{
    expo:{isRunningInExpoGo:()=>!available,requireOptionalNativeModule:()=>available?{}:null},
    'expo-asset':{Asset:{fromModule:()=>asset}}, react,
    'react-native':{AppState:{currentState:'active',addEventListener:(type,fn)=>{const entry={type,fn,removed:false};listeners.push(entry);return {remove:()=>entry.removed=true};}},Text:'Text',View:'View'},
    'react/jsx-runtime':{jsx:(type,props)=>({type,props})},'expo-mediapipe-pose':{PoseCameraView:'PoseCamera'},
    '../shared/repCounter':rep,'../shared/cameraReadiness':shared,'../shared/poseConfig':poseConfig,'../shared/poseSubject':poseSubject,'./assets/pose_landmarker_lite.task':'asset',
  },globals);
}
const context={mode:'readiness',sessionId:'native-test',geometryGeneration:7,previewWidth:300,previewHeight:400,active:true};
const points=()=>Array.from({length:33},()=>({x:.5,y:.5,z:1,visibility:.9,presence:.8}));
const frame=(number=1,extra={})=>({landmarks:points(),worldLandmarks:[],additionalData:{width:480,height:640,cameraFacing:'front',cameraLens:'wide',cameraMirrored:true,cameraZoomFactor:1,receivedAtMs:999999999,frameNumber:number,inferenceDurationMs:20,luminance:.5,poseCount:1,thermalState:'nominal',...extra}});
function callbacks(options=context) {
  const emitted=[],rates=[];let time=0,stops=0,current=true;
  const camera=nativeModule().createNativeCameraCallbacks(options,'front',e=>emitted.push(e),()=>stops++,r=>rates.push(r),()=>current,()=>time);
  return {camera,emitted,rates,setTime:n=>time=n,setCurrent:n=>current=n,get stops(){return stops;}};
}
function envelope(id=1,overrides={}) {
  const p=callbacks();p.camera.frame(frame(id));
  return {...p.emitted[0],observation:{...p.emitted[0].observation,...overrides}};
}
const experimental={...shared.readinessPolicy,dwellMs:1000,calibrated:{web:{fullBody:false,lighting:false,framing:false},native:{fullBody:true,lighting:true,framing:true}},lightingBand:[.2,.8]};

test('tracking tolerates isolated inference errors and fails after three consecutive errors',()=>{
  const p=callbacks({mode:'tracking',requestId:'transient',kind:'curl',side:'left',active:true,fullLandmarks:true});
  p.camera.inferenceError();p.camera.inferenceError();assert.equal(p.stops,0);
  p.camera.frame(frame());
  p.camera.inferenceError();p.camera.inferenceError();assert.equal(p.stops,0);
  p.camera.inferenceError();assert.equal(p.stops,1);
});

test('adapter emits all 33 compact upright/already-mirrored points, luminance, captured session and zero-person frames',()=>{
  const p=callbacks();p.camera.configured();assert.equal(p.emitted[0].type,'reset');
  p.camera.frame(frame());const observation=p.emitted[1].observation;
  assert.equal(observation.landmarks.length,33);assert.equal(observation.luminance,.5);
  assert.equal(observation.coordinatesMirrored,true);assert.equal(observation.previewMirrored,true);
  assert.equal(observation.receivedAt,undefined);assert.equal(observation.landmarks[0].z,undefined);
  assert.equal(shared.projectReadinessPoint({x:.2,y:.5},{...observation,receivedAt:0}).x,.2);
  p.setTime(250);p.camera.frame({...frame(2,{poseCount:0}),landmarks:[]});assert.equal(p.emitted[2].observation.poseCount,0);
  assert.doesNotMatch(JSON.stringify(p.emitted),/base64|segmentation|worldLandmarks|receivedAtMs/);
});
test('receiver owns monotonic receipt freshness and accepts no camera-ready-only evidence',()=>{
  const r=shared.createNativeReadinessReceiver(context,experimental);
  assert.notEqual(r.snapshot().connection.status,'ready');
  r.receive(envelope(1),100);assert.equal(r.snapshot().connection.status,'unknown');
  r.receive(envelope(2),1100);assert.equal(r.snapshot().connection.status,'ready');
  r.receive(envelope(2),2000);r.expire(2500);assert.equal(r.snapshot().connection.reason,'stale');
});
test('receiver rejects malformed, nonfinite, future, oversized, missing geometry, wrong type and old sessions',()=>{
  for(const mutate of [e=>({...e,type:'frame'}),e=>({...e,observation:{...e.observation,receivedAt:Infinity}}),
    e=>({...e,observation:{...e.observation,receivedAt:2000}}),e=>({...e,observation:{...e.observation,frameId:1.1}}),
    e=>({...e,observation:{...e.observation,landmarks:Array(34).fill({x:.5,y:.5})}}),
    e=>({...e,observation:{...e.observation,luminance:NaN}}),e=>({...e,observation:{...e.observation,previewWidth:301}}),
    e=>({...e,extra:'x'.repeat(33000)}),()=>'{bad json']) {
    const r=shared.createNativeReadinessReceiver(context,experimental);
    r.receive(envelope(1),0);r.receive(envelope(2),1000);assert.equal(r.snapshot().connection.status,'ready');
    r.receive(mutate(envelope(3)),1100);assert.notEqual(r.snapshot().connection.status,'ready');
  }
  const r=shared.createNativeReadinessReceiver(context);
  r.receive({...envelope(),sessionId:'old'},0);assert.equal(r.snapshot().localObservations,0);
  r.receive({...envelope(),geometryGeneration:6},0);assert.equal(r.snapshot().localObservations,0);
});
test('terminal capability/error/interruption cannot be revived by old frames or a pending reset',()=>{
  for(const type of ['error','capability','reset']) {
    const r=shared.createNativeReadinessReceiver(context);
    r.receive({type,sessionId:context.sessionId,geometryGeneration:7,reason:'interrupted'},0);
    r.receive({type:'reset',sessionId:context.sessionId,geometryGeneration:7,reason:'pending'},100);
    r.receive(envelope(1),200);r.receive(envelope(2),1300);
    assert.notEqual(r.snapshot().connection.status,'ready');
  }
});
test('missing confidence stays absent and cannot produce a full-body pass',()=>{
  const p=callbacks(),f=frame();f.landmarks=f.landmarks.map(({x,y,z})=>({x,y,z}));p.camera.frame(f);
  assert.equal(p.emitted[0].observation.landmarks[0].visibility,undefined);
  assert.equal(shared.evaluateReadiness({...p.emitted[0].observation,receivedAt:0},experimental).fullBody.status,'unknown');
});
test('adapter rejects duplicate sequence, throttles serious/slow work, and critical thermal state deactivates',()=>{
  const p=callbacks();p.camera.frame(frame(1));p.setTime(250);p.camera.frame(frame(1));assert.equal(p.emitted.length,1);
  p.camera.frame(frame(2,{thermalState:'serious'}));assert.deepEqual(p.rates,[2.5]);assert.equal(p.emitted.length,1);
  p.setTime(500);p.camera.frame(frame(3,{inferenceDurationMs:100}));assert.equal(p.emitted.length,2);
  p.setTime(1000);p.camera.frame(frame(4,{thermalState:'critical'}));assert.equal(p.stops,1);
  p.camera.frame(frame(5));assert.equal(p.emitted.at(-1).type,'error');
});
test('captured callbacks reject obsolete jobs, geometry/lens/zoom changes and lifecycle resume',()=>{
  for(const change of [{cameraFacing:'back'},{cameraLens:'ultraWide'},{cameraZoomFactor:2},{width:640},{cameraMirrored:false}]) {
    const p=callbacks();p.camera.frame(frame());p.setTime(300);p.camera.frame(frame(2,change));
    assert.equal(p.emitted.at(-1).type,'error');assert.equal(p.stops,1);
  }
  for(const stop of ['dispose','lifecycle']) {
    const p=callbacks();p.camera[stop]();const count=p.emitted.length;p.setTime(1000);p.camera.frame(frame());assert.equal(p.emitted.length,count);
  }
  const p=callbacks();p.setCurrent(false);p.camera.frame(frame());assert.equal(p.emitted.length,0);
  const configured=callbacks();assert.equal(configured.camera.configured(),true);assert.equal(configured.camera.configured(),false);assert.equal(configured.stops,1);
});
test('rep options and frame event remain three-joint/request/side compatible',()=>{
  const p=callbacks({requestId:'rep',kind:'squat',side:'left',active:true});p.camera.frame(frame());
  assert.equal(p.emitted[0].type,'frame');assert.equal(p.emitted[0].requestId,'rep');assert.equal(p.emitted[0].side,'left');
  assert.equal(p.emitted[0].frame.joints.length,3);assert.equal(p.emitted[0].sessionId,undefined);
});
test('fixed event serialization escapes script text and validators reject unknown status/context',()=>{
  const script=shared.readinessScript({type:'reset',sessionId:'</script><script>bad()</script>'});
  assert.doesNotMatch(script,/<\/script>/);let event;
  vm.runInNewContext(script,{window:{dispatchEvent:e=>event=e},CustomEvent:class {constructor(type,{detail}){this.type=type;this.detail=detail;}}});
  assert.equal(event.type,'physiquequest-camera-readiness');assert.equal(event.detail.sessionId,'</script><script>bad()</script>');
  for(const bad of [{...context,sessionId:''},{...context,sessionId:'x'.repeat(101)},{...context,previewWidth:Infinity},{...context,mode:'tracking'}]) assert.equal(shared.validateNativeReadinessContext(bad),false);
  assert.equal(shared.validateReadinessCheck({status:'ready',reason:'unsupported'}),false);
  assert.equal(shared.validateReadinessCheck({status:'ready',reason:'<script>'}),false);
});
function hookHarness() {
  let slots=[],cursor=0,effects=[],cleanups=[],writes=0;
  const changed=(old,deps)=>!old || !deps || deps.some((v,i)=>v!==old[i]);
  const memo=(fn,deps)=>{const i=cursor++;if(!slots[i] || changed(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value;};
  return {react:{useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{writes++;slots[i]=typeof v==='function'?v(slots[i]):v;}];},
    useRef(initial){const i=cursor++;return slots[i]??=( {current:initial});},useMemo:memo,useCallback:(fn,deps)=>memo(()=>fn,deps),
    useEffect(fn,deps){const i=cursor++;if(changed(slots[i]?.deps,deps)){slots[i]={deps};effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});}}},
    render(component,props){cursor=0;return component(props);},mount(){effects.forEach(fn=>fn());effects=[];},unmount(){cleanups.forEach(fn=>fn?.());},get writes(){return writes;}};
}
function streamHarness(acquire, recover=false) {
  const h=hookHarness(),window=new EventTarget(),document=new EventTarget(),timers=new Map();
  let next=0,now=0;
  document.visibilityState='visible';
  const module=compile('frontend/hooks/useCameraStream.ts',{react:h.react,'../../shared/cameraReadiness':shared,'../../shared/cameraRecovery':recoveryModule},{window,document,DOMException,
    navigator:{mediaDevices:{getUserMedia:acquire}},requestAnimationFrame:fn=>fn(),
    setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)});
  let context={screen:'live-session',exerciseName:'Curl',equipment:'Dumbbell',elapsed:'00:00'};
  const render=()=>h.render(props=>module.useCameraStream(props,recover),context);
  let camera=render();
  camera.videoRef.current={srcObject:null,play:async()=>{},addEventListener(){},removeEventListener(){}};
  h.mount();
  return {h,window,document,timers,render,setContext:value=>{context=value;},advance(ms){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}}};
}
function streamFixture() {
  const track=new EventTarget();let stopped=0;
  track.muted=false;track.stop=()=>stopped++;
  return {track,stream:{getTracks:()=>[track],getVideoTracks:()=>[track]},get stopped(){return stopped;}};
}
test('browser repeated mute/unmute recovers within five seconds and releases listeners and timers',async()=>{
  const f=streamFixture(),p=streamHarness(async()=>f.stream);
  await p.render().start();
  for(let i=0;i<4;i++) {
    f.track.muted=true;f.track.dispatchEvent(new Event('mute'));p.advance(4900);
    f.track.muted=false;f.track.dispatchEvent(new Event('unmute'));p.advance(200);
    assert.equal(p.render().status,'on');assert.equal(f.stopped,0);assert.equal(p.timers.size,0);
  }
  f.track.muted=true;f.track.dispatchEvent(new Event('mute'));p.advance(5000);
  assert.equal(p.render().status,'unavailable');assert.equal(f.stopped,1);
  assert.match(p.render().message,/Camera delivery stopped/);
  assert.equal(p.timers.size,0);p.h.unmount();
});
test('browser track ended mid-set reaches explicit unavailable state and supports manual reacquisition',async()=>{
  const first=streamFixture(),second=streamFixture();let calls=0;
  const p=streamHarness(async()=>++calls===1?first.stream:second.stream);
  await p.render().start();first.track.dispatchEvent(new Event('ended'));
  assert.equal(p.render().status,'unavailable');assert.equal(first.stopped,1);
  await p.render().start('front');assert.equal(p.render().status,'on');assert.equal(p.render().facing,'front');
  p.h.unmount();assert.equal(second.stopped,1);
});
test('browser rapid front/back requests discard stale streams resolving out of order',async()=>{
  const pending=[];const p=streamHarness(()=>new Promise(resolve=>pending.push(resolve)));
  const a=p.render().start('front'),b=p.render().start('back'),c=p.render().start('front');
  const streams=[streamFixture(),streamFixture(),streamFixture()];
  pending[2](streams[2].stream);await c;pending[0](streams[0].stream);await a;pending[1](streams[1].stream);await b;
  assert.equal(p.render().status,'on');assert.equal(p.render().facing,'front');
  assert.equal(streams[0].stopped,1);assert.equal(streams[1].stopped,1);assert.equal(streams[2].stopped,0);
  p.h.unmount();assert.equal(streams[2].stopped,1);
});
test('browser exercise change while acquiring cancels the old stream but elapsed-label updates do not',async()=>{
  let resolve;const f=streamFixture(),p=streamHarness(()=>new Promise(r=>resolve=r));
  const request=p.render().start();
  p.setContext({screen:'live-session',exerciseName:'Squat',equipment:'Barbell',elapsed:'00:00'});p.render();p.h.mount();
  resolve(f.stream);await request;
  assert.equal(f.stopped,1);assert.equal(p.render().status,'idle');assert.equal(p.render().videoRef.current.srcObject,null);
  const active=streamFixture();let finish;
  // A second pending acquisition survives changes to a display-only elapsed label.
  const q=streamHarness(()=>new Promise(r=>finish=r));const next=q.render().start();
  q.setContext({screen:'live-session',exerciseName:'Curl',equipment:'Dumbbell',elapsed:'00:01'});q.render();q.h.mount();
  finish(active.stream);await next;assert.equal(q.render().status,'on');assert.equal(active.stopped,0);
  q.h.unmount();p.h.unmount();
});
test('recovering live camera resumes automatically after background and keeps the selected facing',async()=>{
  const fixtures=[];const p=streamHarness(async()=>{const f=streamFixture();fixtures.push(f);return f.stream;},true);
  await p.render().start('front');await new Promise(r=>setImmediate(r));assert.equal(p.render().status,'on');
  p.document.visibilityState='hidden';p.document.dispatchEvent(new Event('visibilitychange'));
  assert.notEqual(p.render().status,'on');assert.equal(fixtures[0].stopped,1);
  p.document.visibilityState='visible';p.document.dispatchEvent(new Event('visibilitychange'));p.advance(500);await new Promise(r=>setImmediate(r));
  assert.equal(fixtures.length,2,'foreground must automatically acquire a replacement stream');assert.equal(p.render().status,'on');assert.equal(p.render().facing,'front');p.h.unmount();assert.equal(p.timers.size,0);
});
test('recovering acquisition times out, disposes late stream and bounds waiting with an attempt counter',async()=>{
  const pending=[];const p=streamHarness(()=>new Promise(resolve=>pending.push(resolve)),true);
  await p.render().start('front');assert.equal(p.render().recoveryState.phase,'acquiring');
  p.advance(recoveryModule.CAMERA_ACQUIRE_TIMEOUT_MS);assert.equal(p.render().recoveryState.phase,'recovering');
  const late=streamFixture();pending[0](late.stream);await new Promise(r=>setImmediate(r));assert.equal(late.stopped,1);
  for(const delay of [500,1000,2000]){p.advance(delay);p.advance(recoveryModule.CAMERA_ACQUIRE_TIMEOUT_MS);}
  assert.equal(p.render().recoveryState.phase,'failed');assert.equal(p.render().recoveryState.reason,'timeout');assert.match(p.render().message,/timed out.*Try again/);assert.equal(p.timers.size,0);p.h.unmount();
});
test('facing switch during recovery cannot attach old stream and background cancels pending retry',async()=>{
  const pending=[];const p=streamHarness(()=>new Promise(resolve=>pending.push(resolve)),true);
  await p.render().start('front');p.advance(recoveryModule.CAMERA_ACQUIRE_TIMEOUT_MS);
  p.render().switchFacing();const last=streamFixture(),old=streamFixture();pending[1](last.stream);pending[0](old.stream);await new Promise(r=>setImmediate(r));
  assert.equal(p.render().status,'on');assert.equal(p.render().facing,'back');assert.equal(old.stopped,1);
  last.track.dispatchEvent(new Event('ended'));p.document.visibilityState='hidden';p.document.dispatchEvent(new Event('visibilitychange'));p.advance(500);
  assert.equal(pending.length,2);assert.equal(p.render().recoveryState.phase,'interrupted');p.h.unmount();
});
test('native host interruption automatically reacquires but a native start that never responds times out',async()=>{
  const p=streamHarness(async()=>{throw Error('must use native');},true),messages=[];
  p.window.ReactNativeWebView={postMessage:s=>messages.push(JSON.parse(s))};
  p.render().frameRef.current={getBoundingClientRect:()=>({left:0,top:0,width:300,height:400})};
  const event=detail=>{const e=new Event('physiquequest-camera');e.detail=detail;p.window.dispatchEvent(e);};
  await p.render().start('back');await new Promise(r=>setImmediate(r));const oldGeneration=messages.find(m=>m.type==='camera-start').generation;event({type:'status',status:'on',generation:oldGeneration});assert.equal(p.render().status,'on');
  event({type:'interruption',active:false});event({type:'interruption',active:true});p.advance(500);await new Promise(r=>setImmediate(r));
  assert.equal(messages.filter(m=>m.type==='camera-start').length,2);assert.equal(messages.filter(m=>m.type==='camera-start').at(-1).facing,'back');
  event({type:'status',status:'on',generation:oldGeneration});assert.notEqual(p.render().recoveryState.phase,'ready','obsolete host readiness must not complete the replacement acquisition');
  p.advance(recoveryModule.CAMERA_ACQUIRE_TIMEOUT_MS);assert.equal(p.render().recoveryState.phase,'recovering');p.h.unmount();assert.equal(p.timers.size,0);
});
test('native rapid front/back and exercise replacement ignore obsolete model/configuration callbacks',async()=>{
  const h=hookHarness(),pending=[],emitted=[];let ready=0;
  const module=nativeModule({react:h.react,asset:{downloadAsync:()=>new Promise(resolve=>pending.push(resolve))}});
  const props=(facing,requestId)=>({options:{mode:'tracking',requestId,kind:'curl',side:'left',active:true,fullLandmarks:true},facing,style:[],emit:e=>emitted.push(e),ready:()=>ready++});
  const a=props('front','old'),b=props('back','old'),c=props('front','replacement');
  h.render(module.default,a);h.mount();h.render(module.default,b);h.mount();h.render(module.default,c);h.mount();
  pending[2]({localUri:'current'});await new Promise(r=>setImmediate(r));
  const current=h.render(module.default,c);h.mount();assert.equal(current.type,'PoseCamera');
  pending[0]({localUri:'obsolete-front'});pending[1]({localUri:'obsolete-back'});await new Promise(r=>setImmediate(r));
  const stable=h.render(module.default,c);h.mount();assert.equal(stable.props.poseModelAssetPath,'current');
  stable.props.onCameraConfigured();assert.equal(ready,1);assert.equal(emitted.at(-1).requestId,'replacement');
  h.unmount();const count=emitted.length;stable.props.onLandmark(frame());stable.props.onCameraConfigured();assert.equal(emitted.length,count);
});
test('missing native module, model failure, background/blur and late model promises fail safely with listener cleanup',async()=>{
  assert.equal(nativeModule({available:false}).nativePoseAvailable,false);
  const absent=hookHarness(),unsupported=[];
  const missing=nativeModule({available:false,react:absent.react});
  absent.render(missing.default,{options:context,facing:'front',style:[],emit:e=>unsupported.push(e),ready:()=>{}});absent.mount();
  assert.equal(unsupported[0].reason,'unsupported');absent.unmount();
  const h=hookHarness(),listeners=[],emitted=[];let resolve;
  const module=nativeModule({react:h.react,listeners,asset:{downloadAsync:()=>new Promise(r=>resolve=r)}});
  h.render(module.default,{options:context,facing:'front',style:[],emit:e=>emitted.push(e),ready:()=>{}});h.mount();
  h.unmount();const writes=h.writes;resolve({localUri:'late'});await new Promise(r=>setImmediate(r));
  assert.equal(h.writes,writes);assert.equal(emitted.length,0);assert.ok(listeners.every(l=>l.removed));
  for(const type of ['change','blur']) {
    const h=hookHarness(),listeners=[],emitted=[];
    const module=nativeModule({react:h.react,listeners,asset:{downloadAsync:()=>new Promise(()=>{})}});
    h.render(module.default,{options:context,facing:'front',style:[],emit:e=>emitted.push(e),ready:()=>{}});h.mount();
    listeners.find(l=>l.type===type).fn('background');assert.equal(emitted.at(-1).reason,'interrupted');h.unmount();
  }
  const failure=hookHarness(),errors=[];
  const failing=nativeModule({react:failure.react,asset:{downloadAsync:()=>Promise.reject(new Error('no model'))}});
  failure.render(failing.default,{options:context,facing:'front',style:[],emit:e=>errors.push(e),ready:()=>{}});failure.mount();
  await new Promise(r=>setImmediate(r));assert.equal(errors[0].reason,'model-error');failure.unmount();
});
test('native host executes bounded context/frame and fixed-vocabulary status validation',()=>{
  const host=compile('mobile/App.tsx',{
    'expo-constants':{},'expo-camera':{},'expo-device':{},'expo-network':{},'expo-notifications':{setNotificationHandler(){}},react:{},'./googleSignInError':{},
    'react-native':{StyleSheet:{create:s=>s},Platform:{OS:'android'}},'@react-native-community/netinfo':{},
    'react-native-safe-area-context':{},'react-native-webview':{},'./connection.mjs':{},'./inactivity/nativeMonitor':{},
    './NativeTrackingCamera':{},'./PoseTrackerNative':{},'./FoodScannerCamera':{},'./performance-guard.mjs':{},'../shared/cameraReadiness':shared,
    'react/jsx-runtime':{}, './offlineAccount':{},
  });
  assert.equal(host.isNativeCameraContext({screen:'camera-check',readiness:context}),true);
  for(const raw of ['{broken','null','[]',JSON.stringify({type:3}),JSON.stringify({type:'camera-start',frame:{x:0,y:0,width:0,height:10},facing:'front',previewContext:{screen:'camera-check',readiness:context}}),JSON.stringify({type:'camera-update-overlay',previewContext:{screen:'invalid'}})]) {
    assert.equal(host.parseCameraHostMessage(raw),null,'malformed messages must be ignored before preview state changes');
  }
  assert.equal(host.parseCameraHostMessage(JSON.stringify({type:'camera-stop'})).type,'camera-stop');
  const hostSource=fs.readFileSync('mobile/App.tsx','utf8');
  assert.match(hostSource,/const parsedMessage=parseCameraHostMessage\(e.nativeEvent.data\);\s*if\(!parsedMessage\)return/);
  assert.doesNotMatch(hostSource,/catch \(error\) \{\s*stopNativeCamera\(\);\s*console.warn\('Could not handle malformed/);
  assert.equal(host.isNativeCameraContext({screen:'camera-check'}),false);
  assert.equal(host.isNativeCameraContext({screen:'live-session',exerciseName:'Curl',equipment:'Dumbbell',elapsed:'01:00',tracking:{requestId:'rep',kind:'curl',side:'left',active:true}}),true);
  for(const f of [{x:0,y:0,width:Infinity,height:2},{x:0,y:0,width:-1,height:2},{x:999999,y:0,width:2,height:2}])assert.equal(host.isCameraFrame(f),false);
  assert.equal(host.isCameraFrame({x:10,y:20,width:300,height:400}),true);
  assert.equal(host.nativeFramingText({status:'ready',reason:'<script>'}),'Framing unavailable');
  assert.equal(host.nativeFramingText({status:'adjust',reason:'too-small'}),'Move a little closer');
});

test('live-session hook suppresses lifecycle auto-restart but preserves ordinary stop intent and explicit restart',async()=>{
  for(const interruption of ['blur','hidden','native-idle']) {
    const h=hookHarness(),window=new EventTarget(),document=new EventTarget();let acquisitions=0,stopped=0;
    document.visibilityState='visible';document.hasFocus=()=>true;
    const messages=[];
    if(interruption==='native-idle')window.ReactNativeWebView={postMessage:s=>messages.push(JSON.parse(s))};
    const track={stop:()=>stopped++,addEventListener(){},removeEventListener(){}};
    const module=compile('frontend/hooks/useCameraStream.ts',{react:h.react,'../../shared/cameraReadiness':shared,'../../shared/cameraRecovery':recoveryModule},{window,document,DOMException,
      navigator:{mediaDevices:{getUserMedia:async()=>{acquisitions++;return {getTracks:()=>[track],getVideoTracks:()=>[track]};}}},requestAnimationFrame:fn=>fn()});
    const context={screen:'live-session',exerciseName:'Curl',equipment:'Dumbbell',elapsed:'00:00'};
    const render=()=>h.render(module.useCameraStream,context);
    let camera=render();camera.videoRef.current={srcObject:null,play:async()=>{},addEventListener(){},removeEventListener(){}};
    camera.frameRef.current={getBoundingClientRect:()=>({left:0,top:0,width:300,height:400})};h.mount();
    await camera.start();
    const nativeStatus=status=>{const event=new Event('physiquequest-camera');event.detail={type:'status',status};window.dispatchEvent(event);};
    if(interruption==='native-idle')nativeStatus('on');
    camera=render();h.mount();assert.equal(camera.status,'on');assert.equal(camera.shouldAutoStart,true);
    // Ordinary pause/navigation still preserves the previously enabled camera preference.
    camera.stop();camera=render();h.mount();assert.equal(camera.shouldAutoStart,true);
    await camera.start();if(interruption==='native-idle')nativeStatus('on');camera=render();h.mount();
    if(interruption==='blur') {
      window.dispatchEvent(new Event('blur'));
      camera=render();h.mount();assert.equal(camera.status,'on');
      document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));
    }
    if(interruption==='hidden'){document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));}
    if(interruption==='native-idle')nativeStatus('idle');
    camera=render();h.mount();assert.equal(camera.status,'idle');
    assert.equal(camera.shouldAutoStart,false,`${interruption} must suppress the existing live-session auto-start condition`);
    const before=interruption==='native-idle'?messages.filter(m=>m.type==='camera-start').length:acquisitions;
    // Execute the production caller's active/unpaused auto-start condition.
    if(camera.shouldAutoStart && camera.status==='idle')await camera.start();
    assert.equal(interruption==='native-idle'?messages.filter(m=>m.type==='camera-start').length:acquisitions,before);
    document.visibilityState='visible';camera=render();assert.equal(camera.shouldAutoStart,false);
    await camera.start();if(interruption==='native-idle')nativeStatus('on');camera=render();
    assert.equal(camera.status,'on');assert.equal(camera.shouldAutoStart,true);
    if(interruption!=='native-idle')assert.ok(stopped>=2);
    h.unmount();
  }
});

test('native startup deadline covers asset-resolved silent camera initialization and clears on configure/error/teardown',async()=>{
  for(const finish of ['timeout','configured','error','teardown']) {
    const h=hookHarness(),timers=new Map(),emitted=[];let nextTimer=0,ready=0;
    const module=nativeModule({react:h.react,globals:{setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)}});
    const props={options:context,facing:'front',style:[],emit:e=>emitted.push(e),ready:()=>ready++};
    h.render(module.default,props);h.mount();await new Promise(r=>setImmediate(r));
    const preview=h.render(module.default,props);h.mount();assert.equal(preview.type,'PoseCamera');
    assert.equal(timers.size,1,'asset completion must retain the native configuration deadline');
    const deadline=[...timers.values()][0];assert.equal(deadline.ms,shared.readinessPolicy.initializationMs);
    if(finish==='configured')preview.props.onCameraConfigured();
    if(finish==='error')preview.props.onInferenceError();
    if(finish==='teardown')h.unmount();
    if(finish==='timeout'){timers.clear();deadline.fn();}
    assert.equal(timers.size,0);
    if(finish==='configured'){assert.equal(ready,1);assert.equal(emitted.at(-1).type,'reset');}
    else {
      const count=emitted.length;preview.props.onCameraConfigured();preview.props.onLandmark(frame());
      assert.equal(ready,0);assert.equal(emitted.length,count,'late callbacks cannot revive a failed startup');
      if(finish!=='teardown'){assert.equal(emitted.at(-1).type,'error');assert.match(emitted.at(-1).message,/Restart the camera or continue manually/);}
    }
    h.unmount();assert.equal(timers.size,0);
  }
});

function nativeParentHarness({granted=true}={}) {
  const h=hookHarness(),timers=new Map(),listeners=[];let next=0,now=0,creations=0,suspends=0;
  const app={currentState:'active',addEventListener:(type,fn)=>{const item={type,fn,removed:false};listeners.push(item);return {remove:()=>item.removed=true};}};
  const make=(type,props)=>({type,props});
  const counter={suspend:()=>suspends++,snapshot:()=>({reps:8,partials:2}),update:()=>({reps:8,partials:2,faults:[],visible:true})};
  const noop=()=>{};
  const module=compile('mobile/PoseTrackerNative.tsx',{
    '../shared/poseConfig':poseConfig,react:h.react,'react-native':{AppState:app,View:'View',Text:'Text',Pressable:'Pressable',ActivityIndicator:'Spinner',StyleSheet:{create:x=>x,absoluteFill:{}},useWindowDimensions:()=>({width:400,height:800})},
    'expo-camera':{Camera:{requestCameraPermissionsAsync:async()=>({granted})}},'expo-speech':{stop:async()=>{},speak:noop},'expo-haptics':{},'expo-sensors':{Accelerometer:{isAvailableAsync:async()=>false}},'expo-keep-awake':{activateKeepAwakeAsync:async()=>{},deactivateKeepAwake:noop},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},
    'react-native-svg':{__esModule:true,default:'Svg',Path:'Path'},'react-native-reanimated':{__esModule:true,default:{createAnimatedComponent:()=> 'AnimatedPath'},cancelAnimation:noop,useAnimatedProps:fn=>fn(),useSharedValue:v=>({value:v}),withDelay:()=>0,withTiming:()=>0},
    './NativeTrackingCamera':{__esModule:true,default:'NativeCamera'},'./poseStartGate':{createPoseStartGate:()=>({reset:noop,update:()=>({active:true})}),frameStatus:()=> 'OK'},'../shared/cameraRecovery':recoveryModule,
    '../shared/poseSessionSummary':{createPoseSessionClock:()=>({pause:noop,start:noop,seconds:()=>0}),POSE_ISSUES:{}},'../shared/landmarkFilter':{createLandmarkFilter:()=>({reset:noop,update:x=>x})},'./poseOverlay':{POSE_HOLD_MS:350},'./poseSegments':{createStablePoseSegments:()=>({reset:noop,update:()=>[]})},'./poseCue':{createPoseCueController:()=>({update:()=>({})})},'./poseSafety':{createPoseSafety:()=>({reset:noop})},'./inactivity/nativeAlarm':{startNativeAlarm:noop,stopNativeAlarm:noop},'./inactivity/movement.mjs':{createMovementDetector:()=>({})},'./PoseAlarmScreen':{__esModule:true,default:'Alarm'},
    '../shared/exerciseEngine':{createExerciseCounter:()=>{creations++;return counter;},isPatternId:()=>true,patternSpec:()=>({mode:'bilateral'}),targetFps:()=>10},'react/jsx-runtime':{jsx:make,jsxs:make},
  },{setInterval:()=>1,clearInterval:noop,setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)});
  let props={name:'Curl',pattern:'curl',exercise:'one',close:noop,onSafetyAlarm:noop,onSafetyStop:noop,deliveryStatus:'idle'};
  const render=()=>{const tree=h.render(module.default,props);h.mount();return tree;};
  const nodes=(tree,type)=>{if(!tree||typeof tree!=='object')return [];const found=tree.type===type?[tree]:[];for(const child of [tree.props?.children].flat(Infinity))found.push(...nodes(child,type));return found;};
  return {h,app,timers,counter,render,nodes,get creations(){return creations;},get suspends(){return suspends;},exercise(name){props={...props,name,exercise:name};},event(type,value){if(type==='change')app.currentState=value;for(const l of listeners)if(l.type===type&&!l.removed)l.fn(value);},advance(ms){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}}};
}
test('native parent background recovery preserves totals, bounds blur/focus retries and rechecks pending retry',async()=>{
  const p=nativeParentHarness();p.render();await new Promise(r=>setImmediate(r));p.render();let tree=p.render();
  let camera=p.nodes(tree,'NativeCamera')[0];assert.ok(camera);camera.props.ready();
  p.event('change','background');assert.equal(p.nodes(p.render(),'NativeCamera').length,0);
  p.event('change','active');p.advance(500);tree=p.render();camera=p.nodes(tree,'NativeCamera')[0];assert.ok(camera);camera.props.ready();
  assert.equal(p.creations,1);assert.equal(p.counter.snapshot().reps,8);assert.ok(p.suspends>0);
  camera.props.emit({type:'error',reason:'model-error'});p.event('change','background');p.advance(1000);assert.equal(p.nodes(p.render(),'NativeCamera').length,0);
  p.event('change','active');p.advance(2000);tree=p.render();camera=p.nodes(tree,'NativeCamera')[0];assert.ok(camera);camera.props.ready();
  p.event('blur');p.event('focus');p.advance(2000);tree=p.render();assert.equal(p.nodes(tree,'NativeCamera').length,0,'retry budget must be exhausted');
  assert.ok(JSON.stringify(tree).includes('interrupted too often'));p.h.unmount();assert.equal(p.timers.size,0);
});
test('native parent rejects an old retry and old ready callback after the exercise changes',async()=>{
  const p=nativeParentHarness();p.render();await new Promise(r=>setImmediate(r));p.render();let old=p.nodes(p.render(),'NativeCamera')[0];old.props.ready();old.props.emit({type:'error',reason:'model-error'});
  const stale=[...p.timers.values()][0].fn;p.exercise('Squat');p.render();const current=p.nodes(p.render(),'NativeCamera')[0];assert.ok(current);current.props.ready();
  const writes=p.h.writes;stale();assert.equal(p.h.writes,writes,'stale retry must not mutate the replacement exercise');old.props.ready();assert.equal(p.creations,2);assert.equal(p.timers.size,0);assert.equal(p.nodes(p.render(),'NativeCamera').length,1);p.h.unmount();
});
test('native permission denial renders a specific failed state and Try again without a preparing spinner',async()=>{
  const p=nativeParentHarness({granted:false});p.render();await new Promise(r=>setImmediate(r));p.render();const tree=p.render();
  assert.equal(p.nodes(tree,'NativeCamera').length,0);assert.equal(p.nodes(tree,'Spinner').length,0);assert.match(JSON.stringify(tree),/permission denied/);assert.match(JSON.stringify(tree),/Try again/);assert.equal(p.timers.size,0);p.h.unmount();
});
test('live tracking surfaces opt in to recovery without a hidden-page stop overriding it',()=>{
  for(const name of ['GenericTrackingSession','LiveSession','TrackingSession','SquatFormPreview']) {
    const source=fs.readFileSync(`frontend/sections/Coach/${name}.tsx`,'utf8');
    assert.match(source,/useCameraStream\([\s\S]*?\},\s*true\)/,name);
  }
  const legacy=fs.readFileSync('frontend/sections/Coach/TrackingSession.tsx','utf8');
  assert.doesNotMatch(legacy,/if \(!intent\) camera.stop\(\)/);
  assert.match(legacy,/if \(paused \|\| review\) camera.stop\(\)/);
  const generic=fs.readFileSync('frontend/sections/Coach/GenericTrackingSession.tsx','utf8');
  assert.doesNotMatch(generic,/document.hidden\)camera.stop/);
  assert.match(fs.readFileSync('frontend/hooks/useGenericRepTracking.ts','utf8'),/stopped=true; counter.suspend\(\)/);
});
