'use client';
import { useEffect, useRef, useState } from 'react';
import { api, type ExerciseRecord } from '../../lib/api';
import { canTrack, reconcileNativeTrackingConfig, resolveTrackingConfig, unsupportedTrackingMessage, type TrackingConfig } from '../../../backend/src/pose-tracker/exercise-registry';
import { initialTrackingState, reduceProviderEvent, safeProviderError, trackingUrl, trustedProviderEvent } from '../../services/poseTracker/bridge';
import './posetracker.css';
import GenericTrackingSession from './GenericTrackingSession';
import { titleCase } from '../../lib/titleCase';
import { Icon } from '../Home/icons';
import { isPatternId } from '../../../shared/exerciseEngine';
import type { GeneratedAngleConfig } from '../../../backend/src/pose-tracker/exercise-registry';
// The local pattern engine supplies measurements; this empty generic fallback
// is never used for counting when a pattern is selected.
const localPatternConfig: GeneratedAngleConfig = {
  source: 'gif-derived', verified: false, liveValidated: false, primaryJoints: [], sideMode: 'bilateral',
  startAngles: {}, peakAngles: {}, directions: {}, referenceRanges: {}, stabilityConstraints: [],
  viewHint: 'unknown', cycleCount: 0, validFraction: 0, thresholdsUsed: {}, generatorVersion: 'local-pattern', generatedAt: '',
};
import { parseNativePoseSummary, POSE_ISSUES, type NativePoseSummary } from '../../../shared/poseSessionSummary';
const metricLabels: Record<string,string> = {score:'Movement score',avg_score:'Average score',grade:'Grade',overallScore:'Overall similarity',nccScore:'Shape similarity',dtwScore:'Alignment similarity',timingScore:'Timing similarity',distScore:'Stability similarity'};
const describeScores=(values:Record<string,number|string>)=>Object.entries(values).map(([key,value])=>`${metricLabels[key]??key}: ${value}`).join(' · ');
const formatDuration=(seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;

export default function PoseTrackerSession({exercise,onExit,adminTest=false,onVerified}: {exercise: ExerciseRecord;onExit:()=>void;adminTest?:boolean;onVerified?:(evidence:string)=>void}) {
  const [config,setConfig]=useState<TrackingConfig>(()=>resolveTrackingConfig(exercise));
  const [state,setState]=useState(initialTrackingState);
  const [src,setSrc]=useState('');
  const [stage,setStage]=useState<'setup'|'starting'|'active'|'summary'>('setup');
  const [seconds,setSeconds]=useState(0);
  const [nativeSummary,setNativeSummary]=useState<NativePoseSummary|null>(null);
  const [error,setError]=useState('');
  const [evidence,setEvidence]=useState(false);
  const [consent,setConsent]=useState(false);
  const frame=useRef<HTMLIFrameElement>(null), generation=useRef(0), started=useRef(0), lastMessage=useRef(0);
  const metrics=useRef({iframeLoadMs:0,readyMs:0,events:0,maxProcessingMs:0});
  const live=useRef(false), ready=useRef(false);
  const nativeLive=useRef(false);
  const safetyAlert = useRef<Promise<string | null> | null>(null);
  useEffect(() => {
    const reportStatus = (status: 'pending' | 'delivered' | 'failed') => window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'pose-safety-status', status }));
    const receiveSafety = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (type === 'alarm' && nativeLive.current && !safetyAlert.current) {
        const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `pose-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        reportStatus('pending');
        safetyAlert.current = api.sendInactivityEvent({ idempotencyKey, eventType: 'inactivity', exerciseId: exercise._id })
          .then(record => { reportStatus(record.status === 'delivered' ? 'delivered' : 'failed'); return record._id ?? record.id ?? null; })
          .catch(() => { reportStatus('failed'); return null; });
      } else if (type === 'stop' && safetyAlert.current) {
        void safetyAlert.current.then(id => { if (id) return api.resolveSafetyAlert(id).catch(() => {}); });
      }
    };
    window.addEventListener('physiquequest-pose-safety', receiveSafety);
    return () => window.removeEventListener('physiquequest-pose-safety', receiveSafety);
  }, [exercise._id]);
  const finish=(interrupted=false)=>{generation.current++;live.current=false;nativeLive.current=false;ready.current=false;setSrc('');setConsent(false);setStage('summary');if(interrupted)setState(s=>({...s,ready:false,status:'Tracking interrupted'}));};
  useEffect(()=>{
    let active=true;
    void api.getPoseTrackerConfig(exercise._id).then(c=>{if(active)setConfig(c);}).catch(()=>{});
    return()=>{active=false;generation.current++;live.current=false;};
  },[exercise._id]);
  useEffect(()=>{
    const visibility=()=>{if(document.hidden && live.current && !nativeLive.current)finish(true);};
    const offline=()=>{if(live.current && !nativeLive.current)finish(true);};
    const sessionEnded=()=>{if(live.current){if(nativeLive.current)window.ReactNativeWebView?.postMessage(JSON.stringify({type:'posetracker-native-stop'}));finish(true);}};
    const nativeClosed=(event:Event)=>{if(live.current && nativeLive.current){const summary=parseNativePoseSummary((event as CustomEvent).detail);setNativeSummary(summary);if(summary)setSeconds(summary.durationSeconds);finish();}};
    document.addEventListener('visibilitychange',visibility);window.addEventListener('offline',offline);window.addEventListener('physiquequest:session-ended',sessionEnded);window.addEventListener('physiquequest-posetracker-closed',nativeClosed);
    return()=>{window.ReactNativeWebView?.postMessage(JSON.stringify({type:'posetracker-native-stop'}));document.removeEventListener('visibilitychange',visibility);window.removeEventListener('offline',offline);window.removeEventListener('physiquequest:session-ended',sessionEnded);window.removeEventListener('physiquequest-posetracker-closed',nativeClosed);};
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
    const current=++generation.current;setError('');setState(initialTrackingState());setNativeSummary(null);setSeconds(0);setEvidence(false);safetyAlert.current=null;setStage('starting');live.current=true;ready.current=false;
    metrics.current={iframeLoadMs:0,readyMs:0,events:0,maxProcessingMs:0};
    try { const response=await api.launchPoseTracker(exercise._id,adminTest,Boolean(window.ReactNativeWebView && config.nativePattern));if(current!==generation.current)return;
      const nativeConfig=reconcileNativeTrackingConfig(response.config,resolveTrackingConfig(exercise));
      if(window.ReactNativeWebView && nativeConfig.nativePattern){
        const profile=await api.getProfile().catch(()=>null);if(current!==generation.current)return;
        nativeLive.current=true;setConfig(nativeConfig);window.ReactNativeWebView.postMessage(JSON.stringify({type:'posetracker-native-start',exercise:exercise._id,name:exercise.name,pattern:nativeConfig.nativePattern,support:nativeConfig.nativeSupport??'NOT_YET_VALIDATED',contactName:typeof profile?.contactName==='string'?profile.contactName.slice(0,100):undefined,override:nativeConfig.nativeOverride??null}));setStage('active');return;
      }
      const url=trackingUrl(response.config,response.token ?? '',response.developerOutputs,adminTest,Boolean(window.ReactNativeWebView)&&/Android/i.test(navigator.userAgent));setConfig(nativeConfig);started.current=performance.now();lastMessage.current=Date.now();setSrc(url);
    }catch{if(current===generation.current){live.current=false;setStage('setup');setError('Could not start PoseTracker. Check the camera, connection, and account configuration, then retry.');}}
  };
  const native=Boolean(config.nativePattern && typeof window !== 'undefined' && window.ReactNativeWebView);
  const allowed=(canTrack(config) && (native || config.trackingMode !== 'unavailable'))||(adminTest&&config.trackingMode!=='unavailable'&&config.validationStatus!=='disabled');
  if (!native && config.validationStatus !== 'disabled' && isPatternId(config.nativePattern)) return <GenericTrackingSession name={exercise.name} config={localPatternConfig} pattern={config.nativePattern} override={config.nativeOverride} onExit={onExit}/>;
  if(config.trackingMode==='generated-angle' && config.generatedAngleConfig && allowed) return <GenericTrackingSession name={exercise.name} config={config.generatedAngleConfig} onExit={onExit}/>;
  if ((stage === 'starting' || stage === 'active') && !native) return <section className="pose-live" aria-label="Live exercise tracking">
    <div className="pose-live-camera">
      {src ? <iframe ref={frame} src={src} title={`Live camera: ${exercise.name}`} allow="camera https://app.posetracker.com" referrerPolicy="no-referrer" onLoad={()=>{metrics.current.iframeLoadMs=performance.now()-started.current;}} onError={()=>{setError('The tracking page could not load.');finish(true);}}/> : <div className="pose-live-loading" role="status">Connecting to camera…</div>}
      <div className="pose-live-counter" aria-live="polite"><strong>{state.count ?? '—'}</strong><span>{state.count === 1 ? 'rep' : 'reps'}</span></div>
      <div className="pose-live-bottom"><div className="pose-live-status" role="status">{state.status}<span>{formatDuration(seconds)}</span></div><button type="button" className="pose-live-stop" onClick={()=>finish()}>End session</button></div>
    </div>
  </section>;
  if (stage === 'summary') return <section className="pose-tracker-session pose-results-page" aria-labelledby="pose-summary-title">
    <div className="pose-summary"><p className="pose-summary-kicker">{state.status === 'Tracking interrupted' ? 'SESSION INTERRUPTED' : 'SESSION COMPLETE'}</p>
      <h2 id="pose-summary-title">Your session</h2><p>{titleCase(exercise.name)}</p>
      <div className="pose-summary-stats">
        <div><strong>{nativeSummary?.holdMs != null ? formatDuration(Math.floor(nativeSummary.holdMs / 1000)) : nativeSummary?.completeReps ?? state.count ?? '—'}</strong><span>{nativeSummary?.holdMs != null ? 'Longest hold' : nativeSummary ? 'Complete reps' : 'Detected reps'}</span></div>
        {nativeSummary && nativeSummary.holdMs === null && <div><strong>{nativeSummary.partialReps}</strong><span>Partial reps</span></div>}
        <div><strong>{formatDuration(seconds)}</strong><span>Tracking time</span></div>
      </div>
      <div className="pose-summary-feedback"><h3>Movement feedback</h3>
        {nativeSummary?.issues?.length ? <ul>{nativeSummary.issues.map(issue => <li key={issue.id}><strong>{POSE_ISSUES[issue.id].title}</strong> · {issue.count} {issue.count === 1 ? 'occasion' : 'occasions'}<p>{POSE_ISSUES[issue.id].advice}</p></li>)}</ul> : <p>{nativeSummary ? 'No movement cues were recorded. Tracking can miss issues.' : 'No on-device movement cues were available for this session.'}</p>}
        {state.form && <p>{describeScores(state.form)}</p>}
        {config.trackingMode === 'reference' && state.reference && <p>Reference similarity: {describeScores(state.reference)}.</p>}
        {state.feedback.map((note, index) => <p key={index}>{note}</p>)}
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="pose-summary-note">Feedback and counts are estimates, not a diagnosis or a measure of injury risk. This summary is not saved to your workout; review it before logging your sets.</p>
      {adminTest && evidence && <button type="button" className="secondary" onClick={() => onVerified?.(`Administrator observed provider initialization and a completed counter event on ${new Date().toISOString()}; ${JSON.stringify(metrics.current)}`)}>Use this provider test as verification evidence</button>}
      <button type="button" className="pose-summary-done" onClick={() => setStage('setup')}>Done</button>
    </div>
  </section>;
  return <section className="pose-tracker-session" aria-label="PoseTracker exercise tracking">
    <header className="pose-setup-header"><div className="pq-page-heading"><button type="button" className="coach-back" aria-label="Back to exercise library" onClick={()=>{finish();onExit();}}><Icon name="arrow" size={20}/></button><h2>{titleCase(exercise.name)}</h2></div><span>{native?'On-device tracking':'Powered by PoseTracker'}</span></header>
    <div className="pose-setup-content">
    <div className="pose-setup-exercise">{exercise.gifUrl ? <img className="pose-exercise-thumb" src={exercise.gifUrl} alt=""/> : <span className="pose-setup-placeholder"><Icon name="dumbbell" size={24}/></span>}<div><strong>Your exercise</strong><p>{[config.targetMuscles.join(', '),config.equipment.join(', ')].filter(Boolean).join(' · ') || 'Movement tracking'}</p></div></div>
    <div className="pose-setup-tip"><span><Icon name="camera" size={19}/></span><div><strong>Set up your camera</strong><p>Use good lighting and keep your whole body in view.{config.cameraOrientation === 'front' ? ' Face the camera.' : config.cameraOrientation === 'side' ? ' Turn sideways to the camera.' : ''}</p></div></div>
    <div className="pose-setup-tip"><span><Icon name="warning" size={19}/></span><div><strong>Review your results</strong><p>{allowed ? `Repetition counts are estimates and may be inaccurate.${config.validationStatus !== 'verified' && config.nativeSupport !== 'FULLY_SUPPORTED' ? ' This exercise has not been validated on real recordings.' : ''}` : unsupportedTrackingMessage} Feedback cannot assess pain or injury risk.</p></div></div>
    {adminTest && <details><summary>Tracking details</summary><ul>{config.limitations.map((s,i)=><li key={i}>{s}</li>)}</ul></details>}
    {allowed&&stage==='setup'&&<div className="pose-consent"><h3>Before you start</h3><p>{native?'Camera images and videos are processed on this phone and are not uploaded or retained by PhysiqueQuest. After tracking starts, if neither body nor phone movement is detected, a countdown is followed by an alarm and an attempt to notify your saved emergency contact. Monitoring continues when you leave the camera frame and stops when tracking is paused. No location is shared.':'PoseTracker is a third-party service. Authentication and usage information may be sent to it. PhysiqueQuest does not retain camera frames from this session. Read the '}{!native&&<a href="https://www.posetracker.com/privacy-policy" target="_blank" rel="noopener noreferrer">PoseTracker privacy policy</a>}{!native&&'.'}</p><label><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/> <span>{native?'I agree to camera analysis and the inactivity alert described above.':'I agree to use my camera with PoseTracker.'}</span></label></div>}
    <div className="pose-actions">{allowed&&stage==='setup'&&<button type="button" className="primary" disabled={!consent} onClick={()=>void start()}><Icon name="camera" size={18}/> Start tracking</button>}{(stage==='active'||stage==='starting')&&<button type="button" className="secondary" onClick={()=>finish()}>Stop tracking</button>}</div>
    {src&&<iframe ref={frame} src={src} title={`PoseTracker: ${exercise.name}`} allow="camera https://app.posetracker.com" referrerPolicy="no-referrer" onLoad={()=>{metrics.current.iframeLoadMs=performance.now()-started.current;}} onError={()=>{setError('The tracking page could not load.');finish(true);}}/>}

    {error&&<p role="alert">{error}</p>}
    {state.angles!==undefined&&<details><summary>Provider joint angles</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(state.angles,null,2)}</pre></details>}
    {allowed && <p className="pose-setup-help">{native?'Allow camera access when asked. If it doesn’t open, check your phone’s camera permissions.':'Allow camera access when asked. This tracking option requires an internet connection.'}</p>}
    </div>
  </section>;
}
