'use client';
import { useEffect, useRef, useState } from 'react';
import { api, type ExerciseRecord } from '../../lib/api';
import { canTrack, resolveTrackingConfig, type TrackingConfig } from '../../../backend/src/pose-tracker/exercise-registry';
import { initialTrackingState, reduceProviderEvent, safeProviderError, trackingUrl, trustedProviderEvent } from '../../services/poseTracker/bridge';
import './posetracker.css';
import GenericTrackingSession from './GenericTrackingSession';
const metricLabels: Record<string,string> = {score:'Movement score',avg_score:'Average score',grade:'Grade',overallScore:'Overall similarity',nccScore:'Shape similarity',dtwScore:'Alignment similarity',timingScore:'Timing similarity',distScore:'Stability similarity'};
const describeScores=(values:Record<string,number|string>)=>Object.entries(values).map(([key,value])=>`${metricLabels[key]??key}: ${value}`).join(' · ');

export default function PoseTrackerSession({exercise,onExit,adminTest=false,onVerified}: {exercise: ExerciseRecord;onExit:()=>void;adminTest?:boolean;onVerified?:(evidence:string)=>void}) {
  const [config,setConfig]=useState<TrackingConfig>(()=>resolveTrackingConfig(exercise));
  const [state,setState]=useState(initialTrackingState);
  const [src,setSrc]=useState('');
  const [stage,setStage]=useState<'setup'|'starting'|'active'|'summary'>('setup');
  const [seconds,setSeconds]=useState(0);
  const [error,setError]=useState('');
  const [evidence,setEvidence]=useState(false);
  const [consent,setConsent]=useState(false);
  const frame=useRef<HTMLIFrameElement>(null), generation=useRef(0), started=useRef(0), lastMessage=useRef(0);
  const metrics=useRef({iframeLoadMs:0,readyMs:0,events:0,maxProcessingMs:0});
  const live=useRef(false), ready=useRef(false);
  const finish=(interrupted=false)=>{generation.current++;live.current=false;ready.current=false;setSrc('');setConsent(false);setStage('summary');if(interrupted)setState(s=>({...s,ready:false,status:'Tracking interrupted'}));};
  useEffect(()=>{
    let active=true;
    void api.getPoseTrackerConfig(exercise._id).then(c=>{if(active)setConfig(c);}).catch(()=>{});
    return()=>{active=false;generation.current++;live.current=false;};
  },[exercise._id]);
  useEffect(()=>{
    const visibility=()=>{if(document.hidden && live.current)finish(true);};
    const offline=()=>{if(live.current)finish(true);};
    const nativeClosed=()=>finish();
    document.addEventListener('visibilitychange',visibility);window.addEventListener('offline',offline);window.addEventListener('physiquequest:session-ended',offline);window.addEventListener('physiquequest-posetracker-closed',nativeClosed);
    return()=>{window.ReactNativeWebView?.postMessage(JSON.stringify({type:'posetracker-native-stop'}));document.removeEventListener('visibilitychange',visibility);window.removeEventListener('offline',offline);window.removeEventListener('physiquequest:session-ended',offline);window.removeEventListener('physiquequest-posetracker-closed',nativeClosed);};
  },[]);
  useEffect(()=>{
    if(!src)return;
    let lastProgress=0,lastAngles=0;
    const receive=(message:MessageEvent)=>{
      if(!live.current)return;
      const start=performance.now();
      const event=trustedProviderEvent(message,frame.current?.contentWindow??null);
      if(!event)return;
      lastMessage.current=Date.now();metrics.current.events++;
      if(event.type==='progression') { if(performance.now()-lastProgress<100)return; lastProgress=performance.now(); }
      if(event.type==='angles') { if(performance.now()-lastAngles<250)return; lastAngles=performance.now(); }
      if(event.type==='initialization'){ready.current=event.ready;if(event.ready){metrics.current.readyMs ||= performance.now()-started.current;setStage('active');}}
      if(event.type==='counter'&&ready.current&&event.count>0)setEvidence(true);
      // Raw streams are validated but not retained or rendered on every video frame.
      if(event.type!=='keypoints')setState(s=>reduceProviderEvent(s,event));
      metrics.current.maxProcessingMs=Math.max(metrics.current.maxProcessingMs,performance.now()-start);
      if(event.type==='error'&&!['backend_fallback_cpu','backend_fallback_wasm'].includes(event.code)){setError(safeProviderError(event.code));finish(true);}
      if(event.type==='exercise_summary')finish();
    };
    window.addEventListener('message',receive);
    const timer=window.setInterval(()=>{
      if(!live.current)return;
      setSeconds(Math.floor((performance.now()-started.current)/1000));
      if(!ready.current&&performance.now()-started.current>45000){setError('PoseTracker did not initialize. Check the camera permission, connection, token and plan, then retry.');finish(true);}
      else if(ready.current&&Date.now()-lastMessage.current>30000)setState(s=>({...s,status:'No recent provider updates; check the camera view'}));
    },1000);
    return()=>{window.removeEventListener('message',receive);window.clearInterval(timer);};
  },[src]);
  const start=async()=>{
    if(!consent || live.current)return;
    const current=++generation.current;setError('');setState(initialTrackingState());setSeconds(0);setEvidence(false);setStage('starting');live.current=true;ready.current=false;
    metrics.current={iframeLoadMs:0,readyMs:0,events:0,maxProcessingMs:0};
    try { const response=await api.launchPoseTracker(exercise._id,adminTest);if(current!==generation.current)return;
      if(window.ReactNativeWebView && response.config.trackingMode==='builtin' && response.config.providerExerciseId){
        setConfig(response.config);window.ReactNativeWebView.postMessage(JSON.stringify({type:'posetracker-native-start',token:response.token,exercise:response.config.providerExerciseId,name:exercise.name}));setStage('active');return;
      }
      const url=trackingUrl(response.config,response.token,response.developerOutputs,adminTest,Boolean(window.ReactNativeWebView)&&/Android/i.test(navigator.userAgent));setConfig(response.config);started.current=performance.now();lastMessage.current=Date.now();setSrc(url);
    }catch{if(current===generation.current){live.current=false;setStage('setup');setError('Could not start PoseTracker. Check the camera, connection, and account configuration, then retry.');}}
  };
  const allowed=canTrack(config)||(adminTest&&config.trackingMode!=='unavailable'&&config.validationStatus!=='disabled');
  if(config.trackingMode==='generated-angle' && config.generatedAngleConfig && allowed) return <GenericTrackingSession name={exercise.name} config={config.generatedAngleConfig} onExit={onExit}/>;
  return <section className="pose-tracker-session" aria-label="PoseTracker exercise tracking">
    <header><button type="button" className="secondary" onClick={()=>{finish();onExit();}}>Back to exercise</button><h2>{exercise.name}</h2><span>Powered by PoseTracker</span></header>
    {exercise.gifUrl&&<img className="pose-exercise-thumb" src={exercise.gifUrl} alt={`${exercise.name} demonstration`}/>}
    <p>{config.targetMuscles.join(', ')} · {config.equipment.join(', ')}</p>
    <p>Camera: {config.cameraOrientation === 'reference' ? 'Match the configured reference angle' : config.cameraOrientation}. Keep your whole body visible with good lighting.</p>
    <p>{config.validationStatus==='verified'?'Configuration verified by an administrator.':config.trackingMode==='builtin'?'Built-in mapping; real-person accuracy has not been validated.':'Tracking needs configuration.'}</p>
    <ul>{config.limitations.map((s,i)=><li key={i}>{s}</li>)}</ul>
    {!allowed&&<p>Continue using manual workout logging. An administrator must configure and verify this exercise before camera tracking is available.</p>}
    {allowed&&(stage==='setup'||stage==='summary')&&<div><p>PoseTracker is a third-party service. It requests camera access and describes pose processing as on-device; authentication, usage and technical information may be sent to PoseTracker. PhysiqueQuest does not retain camera frames from this session. Review the <a href="https://www.posetracker.com/privacy-policy" target="_blank" rel="noopener noreferrer">PoseTracker privacy policy</a> before continuing.</p><label><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/> I agree to use my camera with PoseTracker for this session.</label></div>}
    <div className="pose-actions">{allowed&&(stage==='setup'||stage==='summary')&&<button type="button" className="primary" disabled={!consent} onClick={()=>void start()}>Start PoseTracker</button>}{(stage==='active'||stage==='starting')&&<button type="button" className="secondary" onClick={()=>finish()}>Stop tracking</button>}{adminTest&&stage==='summary'&&evidence&&<button type="button" className="secondary" onClick={()=>onVerified?.(`Administrator observed provider initialization and a completed counter event on ${new Date().toISOString()}; ${JSON.stringify(metrics.current)}`)}>Use this provider test as verification evidence</button>}</div>
    {src&&<iframe ref={frame} src={src} title={`PoseTracker: ${exercise.name}`} allow="camera https://app.posetracker.com" referrerPolicy="no-referrer" onLoad={()=>{metrics.current.iframeLoadMs=performance.now()-started.current;}} onError={()=>{setError('The tracking page could not load.');finish(true);}}/>}
    {stage!=='setup'&&<div className="pose-metrics" role="status"><strong>{stage==='summary'?'Session summary':state.status}</strong><p>{seconds} seconds elapsed</p>{config.capabilities.includes('repetitions')&&state.count!==undefined&&<p>{state.count} detected repetitions</p>}{state.progression!==undefined&&<label>Movement progress <progress max={100} value={state.progression}/>{state.progression}%</label>}{state.form&&<p>Provider movement feedback: {describeScores(state.form)}</p>}{config.trackingMode==='reference'&&state.reference&&<p>Similarity to the configured reference: {describeScores(state.reference)}. Similarity does not establish correct technique.</p>}{state.feedback.map((s,i)=><p key={i}>{s}</p>)}</div>}
    {error&&<p role="alert">{error}</p>}
    {state.angles!==undefined&&<details><summary>Provider joint angles</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(state.angles,null,2)}</pre></details>}
    {stage==='summary'&&<p>Unsaved summary. Review these observations before entering your workout values. Session duration is not a verified hold time.</p>}
    <p>Allow camera access inside the tracking view. If unavailable, check your browser camera settings and reconnect the camera. This embedded service requires a connection. PoseTracker describes on-device pose processing; authentication and usage data still reach the provider. PhysiqueQuest does not record camera frames. Feedback cannot assess pain or injury risk.</p>
  </section>;
}
