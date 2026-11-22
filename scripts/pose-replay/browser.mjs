import { createExerciseCounter, resolvePatternSpec, jointAngle } from '/shared/exerciseEngine.ts';
import { createLandmarkFilter } from '/shared/landmarkFilter.ts';
import { resolveTrackingConfig } from '/backend/src/pose-tracker/exercise-registry.ts';
import { trackingFrameInterval } from '/frontend/lib/trackingPerformance.mjs';

function waitEvent(target, type, action, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(Error(`${type} timed out`)), timeout);
    const done = error => { clearTimeout(timer); target.removeEventListener(type, success); target.removeEventListener('error', failure); error ? reject(error) : resolve(); };
    const success = () => done(), failure = () => done(Error(`Video ${type} failed`));
    target.addEventListener(type, success, { once: true }); target.addEventListener('error', failure, { once: true });
    action();
  });
}

window.replayReady = true;
window.runPoseReplay = async ({ clip, catalogExercise, mode = 'offline', soakMs = 0, warmupMs = 300000 }) => {
  const config = resolveTrackingConfig(catalogExercise);
  if (!config.nativePattern) throw Error('No local pattern mapping for selected catalog exercise; do not substitute a different movement');
  const spec = resolvePatternSpec(config.nativePattern, config.nativeOverride);
  const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.preload = 'auto';
  const canvas = document.createElement('canvas'); canvas.width = 390; canvas.height = 480;
  const context = canvas.getContext('2d'); document.body.append(video, canvas);
  const filter = createLandmarkFilter(true);
  let counter = createExerciseCounter(config.nativePattern, { override: config.nativeOverride, exerciseName: catalogExercise.name });
  const worker = new Worker('/frontend/workers/pose.worker.ts', { type: 'module' });
  let pending = null, inFlight = 0, maxInFlight = 0, bitmapsCreated = 0, bitmapsTransferred = 0, bitmapsClosedLocally = 0;
  let currentInterval = 100, lastVideoTime = -1, lastSent = -Infinity, lastResult = 0, staleCandidates = 0, decodedFrames = 0;
  let full = 0, partial = 0, frameNumber = 0, missingWorkingTriplet = 0, drawRmsSum = 0, drawSamples = 0;
  const repEvents = [], cueEvents = [], priorCues = new Set(), memory = [];
  const latencies = [], endToEnd = [];
  const now = () => performance.now();
  const start = now(); let monotonicTimestamp = 0;
  const message = (command, expected, transfer = []) => new Promise((resolve, reject) => {
    if (pending) { reject(Error('More than one worker operation')); return; }
    const timer = setTimeout(() => { pending = null; reject(Error('Worker timeout')); }, 30000);
    pending = { expected, resolve: value => { clearTimeout(timer); pending = null; resolve(value); }, reject: error => { clearTimeout(timer); pending = null; reject(error); } };
    worker.postMessage(command, transfer);
  });
  worker.onmessage = event => {
    if (event.data.type === 'error') pending?.reject(Error(event.data.message));
    else if (pending?.expected === event.data.type) pending.resolve(event.data);
  };
  worker.onerror = event => pending?.reject(Error(event.message));
  const emit = async frame => { if (window.emitPoseFrame) await window.emitPoseFrame(frame); };
  const process = async timestampMs => {
    const receivedAt = now(); inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    let bitmap;
    try {
      const width = Math.min(480, video.videoWidth);
      bitmap = await createImageBitmap(video, { resizeWidth: width, resizeHeight: Math.max(1, Math.round(video.videoHeight * width / video.videoWidth)) }); bitmapsCreated++;
      const result = await message({ type: 'generic-frame', bitmap, timestamp: timestampMs }, 'generic-result', [bitmap]); bitmapsTransferred++; bitmap = null;
      const pose = result.frame;
      if (result.subjectChanged) { counter.suspend(); filter.reset(); }
      const snapshot = counter.update(pose), diagnostics = counter.snapshot().replayDiagnostics;
      const points = filter.update(pose.landmarks, timestampMs);
      context.clearRect(0, 0, canvas.width, canvas.height);
      const sx = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const ox = (canvas.width - video.videoWidth * sx) / 2, oy = (canvas.height - video.videoHeight * sx) / 2;
      context.beginPath(); context.strokeStyle = '#7ef0b2'; context.lineWidth = 3;
      for (const [a,b] of [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]]) {
        if (!points[a] || !points[b] || Math.min(points[a].visibility ?? 1, points[b].visibility ?? 1) < .5) continue;
        context.moveTo(ox + points[a].x * video.videoWidth * sx, oy + points[a].y * video.videoHeight * sx);
        context.lineTo(ox + points[b].x * video.videoWidth * sx, oy + points[b].y * video.videoHeight * sx);
      }
      context.stroke();
      for (let i=0;i<points.length;i++) if ((points[i].visibility ?? 1) >= .5) { drawRmsSum += (points[i].x-pose.landmarks[i].x)**2 + (points[i].y-pose.landmarks[i].y)**2; drawSamples++; }
      const left = jointAngle(pose, spec.joints.left, spec.visibility), right = jointAngle(pose, spec.joints.right, spec.visibility);
      if (left === null && right === null) missingWorkingTriplet++;
      for (let i=full;i<snapshot.reps;i++) repEvents.push({ type:'full', timestampMs: video.currentTime * 1000, monotonicTimestampMs: timestampMs });
      for (let i=partial;i<snapshot.partials;i++) repEvents.push({ type:'partial', timestampMs: video.currentTime * 1000, monotonicTimestampMs: timestampMs });
      full=snapshot.reps; partial=snapshot.partials;
      const faults = new Set(snapshot.faults.map(fault => fault.rule));
      for (const fault of snapshot.faults) if (!priorCues.has(fault.rule)) cueEvents.push({ rule: fault.rule, message: fault.message, timestampMs: video.currentTime * 1000, monotonicTimestampMs: timestampMs });
      priorCues.clear(); faults.forEach(rule => priorCues.add(rule));
      const latency = now()-receivedAt; latencies.push(result.durationMs); endToEnd.push(latency); lastResult=now();
      currentInterval=trackingFrameInterval(result.durationMs, null);
      await emit({ frameNumber:frameNumber++, mediaTimestampMs:video.currentTime*1000, timestampMs, landmarks:pose.landmarks,
        displayedLandmarks:points, leftAngle:left, rightAngle:right, selectedSide:diagnostics?.bilateralSide ?? null,
        sideStates:diagnostics?.sides, subjectChanged:result.subjectChanged, snapshot,
        inferenceMs:result.durationMs, bitmapInferenceDrawMs:latency, inputWidth:width,
        requiredJoints:spec.joints, proposedNextIntervalMs:currentInterval });
    } finally { if (bitmap) { bitmap.close(); bitmapsClosedLocally++; } inFlight--; }
  };
  let memoryTimer;
  try {
    await waitEvent(video, 'loadedmetadata', () => { video.src = `/videos/${encodeURIComponent(clip.fileName)}`; });
    await message({ type:'init', baseUrl:location.origin }, 'ready');
    memoryTimer=setInterval(() => memory.push({ elapsedMs:now()-start, jsHeapBytes:performance.memory?.usedJSHeapSize ?? null, processedFrames:frameNumber, inFlight, staleCandidates }),10000);
    if (mode === 'offline') {
      // Sequential, lossless target sampling. This is NOT a live dropped-frame test.
      for (let t=0;t<video.duration*1000;t+=100) {
        if (Math.abs(video.currentTime-t/1000)>.00001 || video.readyState<2) await waitEvent(video,'seeked',()=>{video.currentTime=t/1000;});
        await process(t+1);
      }
    } else {
      // Wall-clock browser soak: same 50 ms polling, adaptive interval, single
      // outstanding frame and 480px cap as the web hook. Replays are not cameras.
      video.loop=true; await video.play();
      const soakStart=now();
      let job=null, asyncFailure=null;
      while (now()-soakStart<soakMs) {
        const at=now();
        if (at-lastSent>=currentInterval && video.currentTime!==lastVideoTime) {
          if (inFlight) staleCandidates++;
          else {
            if(video.currentTime<lastVideoTime) {counter.suspend();filter.reset();}
            lastSent=at;lastVideoTime=video.currentTime;decodedFrames++;
            monotonicTimestamp=Math.max(monotonicTimestamp+1,at-soakStart+1);
            job=process(monotonicTimestamp).catch(error=>{asyncFailure=error;});
          }
        }
        if(asyncFailure) throw asyncFailure;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      await job;
    }
    const final=counter.snapshot();
    return { fileName:clip.fileName, exerciseId:config.exerciseId, exerciseName:catalogExercise.name, pattern:config.nativePattern,
      profile:'web-worker-and-shared-counter', mode, durationMs:video.duration*1000, wallMs:now()-start,
      processedFrames:frameNumber, missingWorkingTriplet, missingWorkingTripletFraction:frameNumber?missingWorkingTriplet/frameNumber:null,
      fullReps:final.reps, partialReps:final.partials, repEvents, cueEvents, inferenceMs:latencies, bitmapInferenceDrawMs:endToEnd,
      displayedVsRawRmsNormalized:drawSamples?Math.sqrt(drawRmsSum/drawSamples):null,
      maxInFlight,bitmapsCreated,bitmapsTransferred,bitmapsClosedLocally,staleCandidates,decodedFrames,memory,warmupMs,
      cameraRestarts:null, droppedSourceFrames:null,
      limitations:['Desktop browser measurements only; native camera detector, permission flow, thermal behavior and React lifecycle are not exercised.',
        'Offline sampling is 10 Hz without scheduling drops. Soak uses adaptive browser polling. Neither measures camera-to-screen latency.',
        'Cue events are new fault appearances, not native spoken cues. Displayed-vs-raw RMS is smoothing displacement, not ground-truth skeleton error.'] };
  } finally {clearInterval(memoryTimer);worker.postMessage({type:'dispose'});worker.terminate();video.pause();video.removeAttribute('src');video.load();video.remove();canvas.remove();}
};
