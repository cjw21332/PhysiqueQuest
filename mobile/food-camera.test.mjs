import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function cameraHarness(mode='photo',granted=true) {
  const effects=[],results=[],listeners=[],refs=[];
  const jsx=(type,props)=>({type,props});
  const dependencies={
    react:{useRef:value=>{const ref={current:value};refs.push(ref);return ref;},useEffect:fn=>effects.push(fn)},
    'react/jsx-runtime':{jsx,jsxs:jsx},
    'expo-camera':{CameraView:'Camera',useCameraPermissions:()=>[{granted},async()=>({granted})]},
    'react-native':{View:'View',Text:'Text',StyleSheet:{create:s=>s},AppState:{addEventListener:(_,fn)=>{listeners.push(fn);return {remove(){}};}}},
  };
  const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync('mobile/FoodScannerCamera.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,require:name=>dependencies[name],console});
  const request={requestId:'test',mode,frame:{x:10,y:20,width:1000,height:1000},facing:'back',capture:mode==='photo'?1:0};
  const tree=module.exports.default({request,finish:r=>results.push(r)});
  return {effects,results,listeners,refs,tree,camera:tree.props.children[0]?.props};
}

test('native photo surface preserves embedded layout',()=>{
  const h=cameraHarness();
  assert.equal(h.tree.type,'View'); // Embedded preview, never a replacement Modal/screen.
  assert.equal(h.tree.props.pointerEvents,'none');
  const cleanup=h.effects[0]();
  assert.equal(h.camera.onBarcodeScanned,undefined);
  cleanup();
});
test('native permission denial reports error and background cancels the active camera',async()=>{
  const denied=cameraHarness('photo',false);denied.effects[0]();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(denied.results[0].type,'error');
  const active=cameraHarness();active.effects[0]();await new Promise(resolve=>setImmediate(resolve));active.listeners[0]('background');
  assert.equal(active.results[0].type,'cancel');
});
test('opening the system permission prompt does not cancel the photo camera',async()=>{
  const h=cameraHarness();h.effects[0]();
  h.listeners[0]('background');
  assert.equal(h.results.some(result=>result.type==='cancel'),false);
  await new Promise(resolve=>setImmediate(resolve));
  h.camera.onCameraReady();
  assert.equal(h.results.at(-1).type,'ready');
});
test('native shutter waits for ready and returns one photo only',async()=>{
  const h=cameraHarness('photo');h.effects[0]();
  let captures=0;
  h.refs[0].current={takePictureAsync:async()=>{captures++;return {base64:'encoded-photo'};}};
  h.effects[1]();assert.equal(captures,0);
  h.camera.onCameraReady();h.effects[1]();h.effects[1]();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(captures,1);assert.equal(h.results.at(-1).type,'photo');
});
