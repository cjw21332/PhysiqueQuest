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
const rep=compile('shared/repCounter.ts');
function nativeModule({available=true,react={},asset={downloadAsync:()=>Promise.resolve({localUri:'local-model'})},listeners=[],globals={}}={}) {
  return compile('mobile/NativeTrackingCamera.tsx',{
    expo:{isRunningInExpoGo:()=>!available,requireOptionalNativeModule:()=>available?{}:null},
    'expo-asset':{Asset:{fromModule:()=>asset}}, react,
    'react-native':{AppState:{currentState:'active',addEventListener:(type,fn)=>{const entry={type,fn,removed:false};listeners.push(entry);return {remove:()=>entry.removed=true};}},Text:'Text',View:'View'},
    'react/jsx-runtime':{jsx:(type,props)=>({type,props})},'expo-mediapipe-pose':{PoseCameraView:'PoseCamera'},
    '../shared/repCounter':rep,'../shared/cameraReadiness':shared,'./assets/pose_landmarker_lite.task':'asset',
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
    'expo-constants':{},'expo-camera':{},'expo-device':{},'expo-network':{},react:{},
    'react-native':{StyleSheet:{create:s=>s},Platform:{OS:'android'}},'@react-native-community/netinfo':{},
    'react-native-safe-area-context':{},'react-native-webview':{},'./connection.mjs':{},'./inactivity/nativeMonitor':{},
    './NativeTrackingCamera':{},'../shared/cameraReadiness':shared,
    'react/jsx-runtime':{},
  });
  assert.equal(host.isNativeCameraContext({screen:'camera-check',readiness:context}),true);
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
    const module=compile('frontend/hooks/useCameraStream.ts',{react:h.react,'../../shared/cameraReadiness':shared},{window,document,DOMException,
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
    if(interruption==='blur')window.dispatchEvent(new Event('blur'));
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
