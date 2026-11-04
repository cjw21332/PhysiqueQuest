import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { barcodeInsideFoodFrame } from '../shared/foodCamera.ts';

function cameraHarness(mode='barcode',granted=true) {
  const effects=[],results=[],listeners=[],refs=[];
  const jsx=(type,props)=>({type,props});
  const dependencies={
    react:{useRef:value=>{const ref={current:value};refs.push(ref);return ref;},useEffect:fn=>effects.push(fn)},
    'react/jsx-runtime':{jsx,jsxs:jsx},
    'expo-camera':{CameraView:'Camera',useCameraPermissions:()=>[{granted},async()=>({granted})]},
    'react-native':{View:'View',Text:'Text',StyleSheet:{create:s=>s},AppState:{addEventListener:(_,fn)=>{listeners.push(fn);return {remove(){}};}}},
    '../shared/foodCamera':{barcodeInsideFoodFrame},
  };
  const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync('mobile/FoodScannerCamera.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,require:name=>dependencies[name],console});
  const request={requestId:'test',mode,frame:{x:10,y:20,width:1000,height:1000},facing:'back',capture:mode==='photo'?1:0};
  const tree=module.exports.default({request,finish:r=>results.push(r)});
  return {effects,results,listeners,refs,tree,camera:tree.props.children[0]?.props};
}

test('native surface preserves layout and rejects out-of-frame and duplicate barcode callbacks',()=>{
  const h=cameraHarness();
  assert.equal(h.tree.type,'View'); // Embedded preview, never a replacement Modal/screen.
  assert.equal(h.tree.props.pointerEvents,'none');
  const cleanup=h.effects[0]();
  const result={type:'ean13',data:'4006381333931',bounds:{origin:{x:0,y:0},size:{width:100,height:100}}};
  h.camera.onBarcodeScanned(result);assert.equal(h.results.length,0);
  result.bounds.origin={x:200,y:300};
  h.camera.onBarcodeScanned(result);h.camera.onBarcodeScanned(result);
  assert.equal(h.results.length,1);assert.equal(h.results[0].format,'ean_13');
  cleanup();
});
test('native permission denial reports error and background cancels the active camera',async()=>{
  const denied=cameraHarness('photo',false);denied.effects[0]();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(denied.results[0].type,'error');
  const active=cameraHarness();active.effects[0]();active.listeners[0]('background');
  assert.equal(active.results[0].type,'cancel');
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
