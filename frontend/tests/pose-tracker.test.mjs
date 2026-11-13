import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const tiersSource = await readFile(new URL('../../backend/src/pose-tracker/catalog-tiers.ts', import.meta.url), 'utf8');
const tiersUrl = `data:text/javascript;base64,${Buffer.from(transpile(tiersSource)).toString('base64')}`;
const registrySource = (await readFile(new URL('../../backend/src/pose-tracker/exercise-registry.ts',import.meta.url),'utf8')).replace(/\.\/catalog-tiers\.(?:js|ts)/, tiersUrl);
const registryUrl=`data:text/javascript;base64,${Buffer.from(transpile(registrySource)).toString('base64')}`;
const registry=await import(registryUrl);
const bridgeSource=(await readFile(new URL('../services/poseTracker/bridge.ts',import.meta.url),'utf8')).replace('../../../backend/src/pose-tracker/exercise-registry',registryUrl);
const bridge=await import(`data:text/javascript;base64,${Buffer.from(transpile(bridgeSource)).toString('base64')}`);
const squat={exerciseId:'squat-id',name:'quads (bodyweight squat)',equipments:['bodyweight'],targetMuscles:['quadriceps'],instructions:['Bend knees and hips.']};
test('all actual catalog IDs have exactly one registry record',async()=>{
  const audit=JSON.parse(await readFile(new URL('../../output/posetracker-exercise-coverage.json',import.meta.url),'utf8'));
  assert.equal(audit.totalCatalog,1500);assert.equal(audit.uniqueExerciseIds,1500);assert.equal(audit.totalMapped,1500);assert.equal(audit.coverageComplete,true);assert.deepEqual(audit.missingMappings,[]);assert.deepEqual(audit.duplicateMappings,[]);
  assert.equal(audit.records.filter(r=>r.validationStatus==='verified').length,0);
});
test('mapping requires equipment, target and instructional evidence',()=>{
  assert.equal(registry.resolveTrackingConfig(squat).providerExerciseId,'squat');
  for(const patch of [{equipments:['barbell']},{targetMuscles:['biceps']},{instructions:[]},{name:'single leg bodyweight squat'}])assert.equal(registry.resolveTrackingConfig({...squat,...patch}).trackingMode,'unavailable');
  assert.equal(registry.normalizeName('Push-Up'),'push up');
});
test('all exercise categories retain manual pathways',()=>{
  for(const [name,equipment,category] of [['plank','bodyweight','isometric'],['hamstring stretch','bodyweight','mobility'],['leg curl','leverage machine','machine-occlusion'],['cable fly','cable','additional-camera-setup'],['single arm row','dumbbell','multiple-observations']]){
    const config=registry.resolveTrackingConfig({...squat,name,equipments:[equipment]});assert.equal(config.category,category);assert.equal(registry.canTrack(config),false);
  }
});
const reference={trackingMode:'reference',referenceUuid:'12345678-1234-4234-8234-123456789012',cameraOrientation:'side',validationStatus:'pending',limitations:['Test only']};
test('pending and disabled references cannot launch; genuine UUID syntax alone is insufficient',()=>{
  assert.doesNotThrow(()=>registry.validateOverride(reference));
  assert.throws(()=>registry.validateOverride({...reference,referenceUuid:'fake'}));
  assert.throws(()=>registry.validateOverride({...reference,providerExerciseId:'squat'}));
  assert.throws(()=>registry.validateOverride({...reference,validationStatus:'verified'}));
  assert.equal(registry.canTrack(registry.resolveTrackingConfig(squat,reference)),false);
  assert.equal(registry.canTrack(registry.resolveTrackingConfig(squat,{...reference,validationStatus:'disabled'})),false);
});
test('central URL builder handles both modes, flags, and mutual exclusion',()=>{
  const config=registry.resolveTrackingConfig(squat);
  const url=new URL(bridge.trackingUrl(config,'example-test-token'));
  assert.equal(url.origin,bridge.poseTrackerOrigin);assert.equal(url.searchParams.get('exercise'),'squat');assert.equal(url.searchParams.has('reference'),false);assert.equal(url.searchParams.has('angles'),false);
  assert.throws(()=>bridge.trackingUrl(config,''));assert.throws(()=>bridge.trackingUrl({...config,referenceUuid:reference.referenceUuid},'test'));
  const ref=registry.resolveTrackingConfig(squat,{...reference,validationStatus:'verified',verificationNotes:'Synthetic test fixture'});
  const refUrl=new URL(bridge.trackingUrl(ref,'test',true));assert.equal(refUrl.searchParams.has('exercise'),false);assert.equal(refUrl.searchParams.get('reference'),reference.referenceUuid);assert.equal(refUrl.searchParams.get('progression'),'true');
});
test('bridge rejects wrong origin, wrong frame, malformed and unknown messages',()=>{
  const source={};const message={origin:bridge.poseTrackerOrigin,source,data:{type:'counter',current_count:3}};
  assert.equal(bridge.trustedProviderEvent(message,source).count,3);
  assert.equal(bridge.trustedProviderEvent({...message,origin:'https://evil.example'},source),null);
  assert.equal(bridge.trustedProviderEvent(message,{}),null);
  for(const data of ['{',null,[],{type:'counter',current_count:-1},{type:'counter',current_count:Infinity},{type:'progression',value:101},{type:'recommendations',data:[{}]},{type:'imaginary_score',value:100}])assert.equal(bridge.normalizeProviderEvent(data),null);
});
test('current documented JSON events normalize and cannot mark ready before initialization',()=>{
  let state=bridge.initialTrackingState();state=bridge.reduceProviderEvent(state,{type:'counter',count:2});assert.equal(state.count,undefined);
  state=bridge.reduceProviderEvent(state,bridge.normalizeProviderEvent(JSON.stringify({type:'initialization',message:'running',ready:true})));assert.equal(state.ready,true);
  state=bridge.reduceProviderEvent(state,bridge.normalizeProviderEvent({type:'counter',current_count:2,form_score:{score:82,grade:'B'},reference_score:{overallScore:0.8,timingScore:0.9}}));assert.equal(state.count,2);assert.equal(state.form.grade,'B');assert.equal(state.reference.overallScore,0.8);
  state=bridge.reduceProviderEvent(state,bridge.normalizeProviderEvent({type:'recommendations',data:['Keep visible']}));assert.deepEqual(state.feedback,['Keep visible']);
  state=bridge.reduceProviderEvent(state,bridge.normalizeProviderEvent({type:'error',error:'invalid_token',message:'Token invalid'}));assert.equal(state.ready,false);
});
test('provider error messages cannot place credentials or URLs in UI state',()=>{
  const marker='synthetic-private-value';
  for(const code of ['NotAllowedError','NotReadableError','backend_fallback_cpu','backend_fallback_wasm','unexpected']){
    const state=bridge.reduceProviderEvent({...bridge.initialTrackingState(),ready:true},{type:'error',code,message:`https://example.invalid/?token=${marker}`});
    assert.equal(JSON.stringify(state).includes(marker),false);
    assert.equal(JSON.stringify(state).includes('https://'),false);
  }
});
test('coverage audit detects duplicates, missing IDs and orphan overrides',()=>{
  const duplicate=registry.auditCoverage([squat,squat],{orphan:reference});assert.equal(duplicate.coverageComplete,false);assert.deepEqual(duplicate.duplicateMappings,['squat-id']);assert.deepEqual(duplicate.orphanOverrides,['orphan']);
  assert.equal(registry.auditCoverage([{name:'no id'}]).coverageComplete,false);
});
