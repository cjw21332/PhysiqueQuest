'use client';
import { useEffect, useMemo, useState } from 'react';
import { useCameraStream } from '../../hooks/useCameraStream';
import { useGenericRepTracking } from '../../hooks/useGenericRepTracking';
import type { GeneratedAngleConfig } from '../../../backend/src/pose-tracker/exercise-registry';
import './posetracker.css';
import { Icon } from '../Home/icons';
import { titleCase } from '../../lib/titleCase';
import { movementPhaseLabels } from '../../../shared/movementTelemetry';
import { patternSpec, type PatternId, type ExerciseConfigOverride } from '../../../shared/exerciseEngine';

export default function GenericTrackingSession({name,config,onExit,pattern,override}:{name:string;config:GeneratedAngleConfig;onExit:()=>void;pattern?:PatternId;override?:ExerciseConfigOverride}) {
  const [stage,setStage]=useState<'setup'|'active'|'summary'>('setup');
  const [summary,setSummary]=useState({reps:0,partial:0});
  const [visualOptions,setVisualOptions]=useState({skeleton:true,guides:true});
  const phaseLabels=movementPhaseLabels(pattern);
  const hold=pattern ? patternSpec(pattern).mode==='hold' : false;
  const localConfig=useMemo(()=>({...config,stabilityConstraints:[]}),[config]);
  const camera=useCameraStream({screen:'live-session',exerciseName:name,equipment:'',elapsed:''});
  const tracking=useGenericRepTracking(localConfig,stage==='active' && camera.status==='on' && !camera.nativePreview,camera.videoRef,pattern,override,name,visualOptions,camera.generation);
  const timing=tracking.motion.current ?? tracking.motion.last;
  useEffect(()=>{const hide=()=>{if(document.hidden)camera.stop(true);};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[camera.stop]);
  const finish=()=>{setSummary({reps:tracking.repCount,partial:tracking.partialCount});camera.stop(true);setStage('summary');};
  return <section className="generic-tracking" aria-label="Experimental movement tracking">
    <header className="generic-tracking-head"><div><span className="generic-tracking-tag">Experimental tracking</span><h3>{titleCase(name)}</h3></div><button className="secondary" type="button" aria-label="Close tracking" onClick={()=>{camera.stop(true);onExit();}}><Icon name="close" size={19}/></button></header>
    <p className="generic-tracking-note">Counts are estimates. Keep the working joints visible; a full-body view is optional. Tracking cannot assess safe form, pain, injury risk, or load.</p>
    {stage!=='summary'?<>
      <div ref={camera.frameRef} className="live-video generic-tracking-camera"><video ref={camera.videoRef} className={`live-camera ${camera.facing==='front'?'front-facing':''}`} autoPlay muted playsInline /><canvas ref={tracking.overlayRef} aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',transform:camera.facing==='front'?'scaleX(-1)':undefined}} />{camera.status==='on'&&<div className="motion-rep-hud" aria-live="polite" aria-atomic="true"><strong>{hold?(tracking.holdDurationMs/1000).toFixed(1):tracking.repCount}</strong><span>{hold?'seconds':'complete reps'}</span>{!hold&&<small>{tracking.partialCount} partial</small>}</div>}{camera.status!=='on'&&<div className="generic-camera-placeholder">Your camera preview will appear here.</div>}</div>
      <div className="motion-guide-controls"><label><input type="checkbox" checked={visualOptions.skeleton} onChange={event=>setVisualOptions(current=>({...current,skeleton:event.target.checked}))}/>Skeleton</label><label><input type="checkbox" checked={visualOptions.guides} onChange={event=>setVisualOptions(current=>({...current,guides:event.target.checked}))}/>Body path</label><button type="button" className="secondary" onClick={tracking.resetMotion}>Reset reference</button></div>
      {!hold&&<div className="motion-timing-row" aria-label="Sampled repetition timing">{phaseLabels.map((label,index)=><div key={label}><span>{label}</span><strong>{timing?`${([timing.moveMs,timing.holdMs,timing.returnMs][index]/1000).toFixed(1)}s`:'—'}</strong></div>)}</div>}
      <p className="generic-tracking-note">The dashed line marks your starting screen position. Timing uses visible samples.</p>
      <div className="generic-tracking-status" role="status"><strong>{camera.status==='on'?tracking.status:'Camera is off.'}</strong>{camera.status==='on'&&tracking.cue&&<span>{tracking.cue}</span>}</div>
      <div className="generic-tracking-metrics"><div><strong>{tracking.repCount}</strong><span>Detected reps</span></div><div><strong>{tracking.partialCount}</strong><span>Partial movements</span></div></div>
      <label className="generic-tracking-progress">Movement progress <progress max={1} value={tracking.currentProgress}/></label>
      {stage==='active'&&tracking.powerNotice&&<p className="generic-tracking-note">{tracking.powerNotice}</p>}
      {stage==='active'&&<p className="generic-tracking-note">Device temperature is not available in this browser. Pause if your device feels warm.</p>}
      {camera.message&&<p role="alert">{camera.message}</p>}
      <div className="generic-tracking-actions">{camera.status!=='on'&&<button className="primary" type="button" disabled={camera.status==='starting'} onClick={()=>{setStage('active');void camera.start();}}>{camera.status==='starting'?'Starting camera…':'Start camera'}</button>}
      {camera.status==='on'&&<button className="secondary" type="button" onClick={camera.switchFacing}>Switch camera</button>}
      {stage==='active'&&<button className="secondary" type="button" onClick={finish}>Finish tracking</button>}</div>
      {camera.nativePreview&&<p>Experimental tracking is available in a browser, not the native camera view.</p>}
    </>:<div className="generic-tracking-summary"><h4>Unsaved summary</h4><p>{summary.reps} detected repetitions · {summary.partial} partial movements</p><p>Review and enter your workout values manually. No camera images or results were saved.</p><button className="primary" type="button" onClick={onExit}>Confirm and return</button></div>}
  </section>;
}
