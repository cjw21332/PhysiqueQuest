import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { Asset } from 'expo-asset';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Text, View, type ViewStyle } from 'react-native';
import type { PoseCameraViewProps, PoseFrame, PosePerformanceMetrics } from 'expo-mediapipe-pose';
import { jointIndices, type TrackingKind, type TrackingSide } from '../shared/repCounter';
import { readinessPolicy, validateReadinessObservation, type NativeReadinessContext, type ReadinessReason } from '../shared/cameraReadiness';

export type NativeTrackingOptions = { mode?: 'tracking'; requestId: string; kind: TrackingKind; side: TrackingSide; active: boolean };
export type NativeReadinessOptions = NativeReadinessContext;
export const nativePoseAvailable = !isRunningInExpoGo() && !!requireOptionalNativeModule('ExpoMediaPipePose');
// Expo Go keeps the normal camera usable without loading an unavailable native view.
const PoseCamera = nativePoseAvailable ? (require('expo-mediapipe-pose') as typeof import('expo-mediapipe-pose')).PoseCameraView : null;

export function poseScript(detail: Record<string, unknown>) {
  return `(function(){window.dispatchEvent(new CustomEvent('physiquequest-pose',{detail:${JSON.stringify(detail).replace(/</g, '\\u003c')}}));})();true;`;
}

// Captures one camera job's identity; obsolete callbacks never read replacement options.
export function createNativeCameraCallbacks(options: NativeTrackingOptions | NativeReadinessOptions, facing: 'front'|'back',
  emit: (detail:Record<string,unknown>)=>void, deactivate:()=>void, throttle:(fps:number)=>void, current:()=>boolean=()=>true,
  now:()=>number=()=>performance.now()) {
  let disposed=false, lastFrame=-1, lastAt=-Infinity, geometry='', configured=false;
  const readiness=options.mode==='readiness';
  let interval=readiness ? readinessPolicy.samplingMs : 100;
  const valid=()=>!disposed && current() && options.active;
  const send=(detail:Record<string,unknown>)=>{
    if(!valid())return;
    emit(readiness ? {...detail,sessionId:options.sessionId,geometryGeneration:options.geometryGeneration} : {...detail,requestId:options.requestId,side:options.side});
  };
  const fail=(reason:ReadinessReason='model-error',thermal=false)=>{
    if(!valid())return;
    send({type:'error',reason,message:thermal?'Camera paused because the phone is too warm. Let it cool down or continue manually.':reason==='interrupted'?'Camera interrupted. Restart the camera or continue manually.':'Camera tracking unavailable. Restart the camera or continue manually.'});
    disposed=true;deactivate();
  };
  return {
    dispose(){disposed=true;}, fail,
    lifecycle(){fail('interrupted');},
    configured(){if(!valid())return false;if(configured){fail('interrupted');return false;}configured=true;send({type:'reset',reason:'pending'});return true;},
    frame(frame:PoseFrame) {
      if(!valid())return;
      const data=frame.additionalData, at=now();
      if(data.thermalState==='critical'){fail('interrupted',true);return;}
      if(data.thermalState==='serious' || data.inferenceDurationMs>80){interval=readiness?400:200;throttle(readiness?2.5:5);}
      if(!Number.isFinite(at) || !Number.isFinite(data.inferenceDurationMs) || data.inferenceDurationMs<0 ||
        !['front','back'].includes(data.cameraFacing) || data.cameraFacing!==facing || !['wide','ultraWide'].includes(data.cameraLens) ||
        !Number.isFinite(data.cameraZoomFactor) || data.cameraZoomFactor<1 || data.cameraZoomFactor>100 || typeof data.cameraMirrored!=='boolean' ||
        !Number.isSafeInteger(data.frameNumber) || data.frameNumber<0) {fail();return;}
      const identity=JSON.stringify([data.width,data.height,data.cameraFacing,data.cameraLens,data.cameraMirrored,data.cameraZoomFactor]);
      if(geometry && geometry!==identity){fail('interrupted');return;}
      geometry=identity;
      if(data.frameNumber<=lastFrame || at-lastAt<interval)return;
      if(readiness) {
        const observation={platform:'native' as const,sessionId:options.sessionId,geometryGeneration:options.geometryGeneration,
          frameId:data.frameNumber,sourceWidth:data.width,sourceHeight:data.height,previewWidth:options.previewWidth,previewHeight:options.previewHeight,
          coordinatesMirrored:data.cameraMirrored,previewMirrored:data.cameraMirrored,poseCount:data.poseCount,
          landmarks:frame.landmarks.length<=33 ? frame.landmarks.map(p=>({x:p.x,y:p.y,...(p.visibility===undefined?{}:{visibility:p.visibility}),...(p.presence===undefined?{}:{presence:p.presence})})) : [],
          luminance:data.luminance};
        if(frame.landmarks.length>33 || (data.luminance!==undefined && (!Number.isFinite(data.luminance) || data.luminance<0 || data.luminance>1)) ||
          !validateReadinessObservation({...observation,receivedAt:at})){fail();return;}
        send({type:'observation',observation});
      } else {
        send({type:'frame',frame:{joints:frame.landmarks.length?jointIndices(options.kind,options.side).map(index=>frame.landmarks[index]):[],aspect:data.width/data.height,timestamp:at}});
      }
      lastFrame=data.frameNumber;lastAt=at;
    },
    metrics(data:PosePerformanceMetrics){if(!readiness)send({type:'metrics',fps:data.inferenceFps});},
  };
}

export default function NativeTrackingCamera({ options, facing, style, emit, ready }: { options: NativeTrackingOptions | NativeReadinessOptions; facing: 'front' | 'back'; style: ViewStyle[]; emit: (detail: Record<string, unknown>) => void; ready: () => void }) {
  const [modelPath,setModelPath]=useState<string|null>(null), [failed,setFailed]=useState(false);
  const [limit,setLimit]=useState(options.mode==='readiness'?5:10);
  const identity=JSON.stringify([options,facing]);
  const liveIdentity=useRef(identity);liveIdentity.current=identity;
  const emitRef=useRef(emit);emitRef.current=emit;
  const startupTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const clearStartup=()=>{if(startupTimer.current!==null){clearTimeout(startupTimer.current);startupTimer.current=null;}};
  const callbacks=useMemo(()=>createNativeCameraCallbacks(options,facing,detail=>emitRef.current(detail),()=>{clearStartup();setFailed(true);},setLimit,()=>liveIdentity.current===identity),[identity]);
  useEffect(()=>{
    let active=true;
    setModelPath(null);setFailed(false);
    if(!nativePoseAvailable){callbacks.fail('unsupported');return ()=>callbacks.dispose();}
    const timeout=setTimeout(()=>{active=false;callbacks.fail();},readinessPolicy.initializationMs);
    startupTimer.current=timeout;
    Asset.fromModule(require('./assets/pose_landmarker_lite.task')).downloadAsync().then(asset=>{
      if(!active || liveIdentity.current!==identity)return;
      if(!asset.localUri)throw new Error('Model unavailable');
      setModelPath(asset.localUri);
    }).catch(()=>{if(active)callbacks.fail();});
    const change=AppState.addEventListener('change',state=>{if(state!=='active')callbacks.lifecycle();});
    const blur=AppState.addEventListener('blur',()=>callbacks.lifecycle());
    if(AppState.currentState!=='active')callbacks.lifecycle();
    return ()=>{active=false;clearTimeout(timeout);if(startupTimer.current===timeout)startupTimer.current=null;callbacks.dispose();change.remove();blur.remove();};
  },[callbacks,identity]);
  const isActive=options.active && !failed;
  if (!PoseCamera || !modelPath || failed) return <View style={style}><Text>{failed ? 'Camera tracking unavailable. Continue manually.' : 'Loading camera tracking…'}</Text></View>;
  const props: PoseCameraViewProps = {
    cameraFacing: facing, isActive, poseModelVariant: 'lite', poseModelAssetPath: modelPath,
    previewFps: 30, frameLimit: limit, callbackFps: limit, maxPoses: 1,
    segmentationEnabled: false, skeleton: false,
    minPoseDetectionConfidence: 0.6, minPosePresenceConfidence: 0.6, minTrackingConfidence: 0.6,
    onLandmark:callbacks.frame, onPerformanceMetrics:callbacks.metrics,
    onCameraConfigured:()=>{if(callbacks.configured() && liveIdentity.current===identity){clearStartup();ready();}},
    onInferenceError:()=>callbacks.fail(),
  };
  return <PoseCamera {...props} style={style}/>;
}
