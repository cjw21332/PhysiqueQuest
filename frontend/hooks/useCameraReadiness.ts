'use client';

import { useEffect, useState, type RefObject } from 'react';
import { createReadinessController, createNativeReadinessReceiver, readinessPolicy, readinessSessionId, type ReadinessReason } from '../../shared/cameraReadiness';

export function useCameraReadiness(options: {
  videoRef: RefObject<HTMLVideoElement | null>; frameRef: RefObject<HTMLDivElement | null>;
  active: boolean; native: boolean; generation: number; generationRef: RefObject<number>; mirrored: boolean;
}) {
  const { videoRef, frameRef, active, native, generation, generationRef, mirrored }=options;
  const [record,setRecord]=useState(()=>({generation:-1,snapshot:createReadinessController().snapshot()}));
  useEffect(()=>{
    const controller=createReadinessController(), sessionId=`web-${generation}`;
    controller.reset(sessionId,generation,active?'pending':'disabled',performance.now());
    const publish=()=>setRecord(previous=>{
      const next=controller.snapshot();
      return previous.generation===generation && JSON.stringify(previous.snapshot)===JSON.stringify(next)?previous:{generation,snapshot:next};
    });
    if(!active) {
      controller.reset(sessionId,generation,'disabled'); publish(); return;
    }
    if(native) {
      const rect=frameRef.current?.getBoundingClientRect();
      const receiver=createNativeReadinessReceiver({mode:'readiness',sessionId:readinessSessionId(generation),geometryGeneration:generation,
        previewWidth:rect?.width??0,previewHeight:rect?.height??0,active:true});
      let disposed=false;
      const nativePublish=()=>{
        if(disposed || generationRef.current!==generation)return;
        const snapshot=receiver.snapshot();
        setRecord(previous=>previous.generation===generation && JSON.stringify(previous.snapshot)===JSON.stringify(snapshot)?previous:{generation,snapshot});
        window.ReactNativeWebView?.postMessage(JSON.stringify({type:'camera-readiness-status',sessionId:readinessSessionId(generation),geometryGeneration:generation,framing:snapshot.framing}));
      };
      const receive=(event:Event)=>{
        if(disposed || generationRef.current!==generation)return;
        receiver.receive((event as CustomEvent).detail,performance.now());nativePublish();
      };
      window.addEventListener('physiquequest-camera-readiness',receive);
      const timer=window.setInterval(()=>{receiver.expire(performance.now());nativePublish();},200);
      nativePublish();
      return ()=>{disposed=true;clearInterval(timer);window.removeEventListener('physiquequest-camera-readiness',receive);};
    }
    let disposed=false, worker: Worker | undefined, ready=false, busy=false, inferenceError: ReadinessReason | undefined;
    let frameId=0, lastMediaTime=-1, lastSent=-Infinity, sentAt=0, lastTimestamp=0, interval=readinessPolicy.samplingMs;
    let callbackId: number | undefined;
    const video=videoRef.current;
    const current=()=>!disposed && generationRef.current===generation;
    const fail=(reason: ReadinessReason)=>{
      if(!current()) return;
      inferenceError=reason; ready=false; busy=false; worker?.postMessage({type:'dispose'}); worker?.terminate(); worker=undefined;
      controller.unavailable(reason); publish();
    };
    if(!window.Worker || !window.createImageBitmap || !window.OffscreenCanvas) inferenceError='unsupported';
    else {
      try {
        worker=new Worker(new URL('../workers/pose.worker.ts',import.meta.url));
        worker.onmessage=event=>{
          if(!current()) return;
          if(event.data?.type==='ready') {ready=true; return;}
          if(event.data?.type==='error') {fail('model-error'); return;}
          if(event.data?.type!=='readiness-result' || !busy) return;
          const now=performance.now(), observation=event.data.observation;
          if(observation?.sessionId!==sessionId || observation?.frameId!==frameId) return;
          busy=false;
          const rect=frameRef.current?.getBoundingClientRect();
          controller.observe({...observation, platform:'web',receivedAt:sentAt,
            previewWidth:rect?.width,previewHeight:rect?.height,geometryGeneration:generation,
            coordinatesMirrored:false,previewMirrored:mirrored},now);
          interval=Math.max(readinessPolicy.samplingMs,Math.min(1000,Number.isFinite(event.data.durationMs)?event.data.durationMs*2:1000));
          publish();
        };
        worker.onerror=()=>fail('model-error');
        worker.postMessage({type:'init',baseUrl:window.location.origin});
      } catch { fail('unsupported'); }
    }
    const initTimeout=window.setTimeout(()=>{if(!ready && !inferenceError)fail('model-error');},readinessPolicy.initializationMs);
    const decoded=(mediaTime:number)=>{
      if(!current() || !video || video.readyState<2 || video.videoWidth<=0 || video.videoHeight<=0 || !Number.isFinite(mediaTime) || mediaTime<=lastMediaTime) return;
      lastMediaTime=mediaTime;
      controller.frame({sessionId,frameId:Math.round(mediaTime*1000000),receivedAt:performance.now()});
      publish();
    };
    const hasFrameCallback=!!video?.requestVideoFrameCallback;
    const onVideoFrame: VideoFrameRequestCallback=(_now,metadata)=>{
      decoded(metadata.mediaTime);
      if(current() && video) callbackId=video.requestVideoFrameCallback(onVideoFrame);
    };
    if(hasFrameCallback && video) callbackId=video.requestVideoFrameCallback(onVideoFrame);
    const timer=window.setInterval(async()=>{
      if(!current())return;
      const now=performance.now();
      if(!hasFrameCallback && video) decoded(video.currentTime);
      controller.expire(now);
      if(inferenceError)controller.unavailable(inferenceError);
      else if(!ready)controller.unavailable('pending');
      publish();
      if(busy && now-sentAt>readinessPolicy.inferenceTimeoutMs) {fail('model-error');return;}
      if(!ready || busy || !video || video.readyState<2 || video.videoWidth<=0 || video.videoHeight<=0 ||
        now-lastSent<interval || controller.snapshot().connection.reason==='stale' || lastMediaTime<0) return;
      // Each inference consumes a newly delivered frame, including with the fallback.
      if(lastSent>=0 && lastMediaTime<=lastTimestamp)return;
      busy=true; sentAt=now; lastSent=now; lastTimestamp=lastMediaTime; frameId++;
      let bitmap: ImageBitmap | undefined;
      try {
        const width=Math.min(480,video.videoWidth);
        bitmap=await createImageBitmap(video,{resizeWidth:width,resizeHeight:Math.max(1,Math.round(video.videoHeight*width/video.videoWidth))});
        if(!current() || !ready || !worker)return;
        worker.postMessage({type:'readiness-frame',bitmap,timestamp:now,sessionId,frameId},[bitmap]);
        bitmap=undefined;
      } catch {if(current())fail('model-error');}
      finally {bitmap?.close();}
    },100);
    publish();
    return ()=>{
      disposed=true; clearTimeout(initTimeout);clearInterval(timer);
      if(video && callbackId!==undefined)video.cancelVideoFrameCallback(callbackId);
      worker?.postMessage({type:'dispose'});worker?.terminate();
    };
  },[active,native,generation,generationRef,mirrored,videoRef,frameRef]);
  if(record.generation===generation)return record.snapshot;
  const initial=createReadinessController();
  return initial.reset(`web-${generation}`,generation,active?'pending':'disabled');
}
