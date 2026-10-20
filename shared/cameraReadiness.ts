export type ReadinessStatus = 'ready' | 'adjust' | 'unknown';
export type ReadinessReason = 'pending' | 'disabled' | 'uncalibrated' | 'no-pose' | 'invalid' | 'uncertain' | 'clipped' | 'too-small' | 'too-large' | 'bent' | 'stable' | 'stale' | 'model-error' | 'unsupported' | 'interrupted' | 'dim' | 'bright';
export type ReadinessCheck = { status: ReadinessStatus; reason: ReadinessReason };
export type ReadinessLandmark = { x: number; y: number; visibility?: number; presence?: number };
export type ReadinessObservation = {
  platform: 'web' | 'native'; sessionId: string; frameId: number; receivedAt: number;
  sourceWidth: number; sourceHeight: number; previewWidth: number; previewHeight: number;
  geometryGeneration: number; coordinatesMirrored: boolean; previewMirrored: boolean;
  poseCount: number; landmarks: ReadinessLandmark[]; luminance?: number;
};
export type ReadinessSnapshot = { connection: ReadinessCheck; fullBody: ReadinessCheck; lighting: ReadinessCheck; framing: ReadinessCheck; localObservations: number };
export type ReadinessPolicy = {
  confidence: number; margin: number; heightBand: readonly [number, number]; dwellMs: number; expiryMs: number;
  samplingMs: number; initializationMs: number; inferenceTimeoutMs: number; allowEarHead: boolean;
  lightingBand?: readonly [number, number];
  calibrated: Record<'web' | 'native', { fullBody: boolean; lighting: boolean; framing: boolean }>;
};
// Provisional experiments only. Device evidence must support each flag before enabling it.
export const readinessPolicy: ReadinessPolicy = {
  confidence: .65, margin: .04, heightBand: [.55, .85], dwellMs: 1000, expiryMs: 1250,
  samplingMs: 200, initializationMs: 10000, inferenceTimeoutMs: 5000, allowEarHead: false,
  calibrated: { web: { fullBody: false, lighting: false, framing: false }, native: { fullBody: false, lighting: false, framing: false } },
};
const unknown = (reason: ReadinessReason): ReadinessCheck => ({ status: 'unknown', reason });
const ready = (): ReadinessCheck => ({ status: 'ready', reason: 'stable' });
const adjust = (reason: ReadinessReason): ReadinessCheck => ({ status: 'adjust', reason });
const integer = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0;
const dimension = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 32768;
const confidence = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;

export function validateReadinessObservation(value: unknown): value is ReadinessObservation {
  if (!value || typeof value !== 'object') return false;
  const o = value as ReadinessObservation;
  return (o.platform === 'web' || o.platform === 'native') && typeof o.sessionId === 'string' && o.sessionId.length > 0 && o.sessionId.length <= 100 &&
    integer(o.frameId) && integer(o.geometryGeneration) && Number.isFinite(o.receivedAt) && o.receivedAt >= 0 &&
    [o.sourceWidth, o.sourceHeight, o.previewWidth, o.previewHeight].every(dimension) &&
    typeof o.coordinatesMirrored === 'boolean' && typeof o.previewMirrored === 'boolean' &&
    integer(o.poseCount) && o.poseCount <= 1 && Array.isArray(o.landmarks) && o.landmarks.length <= 33 &&
    Array.from(o.landmarks).every(p => p && typeof p === 'object' && Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= -2 && p.x <= 3 && p.y >= -2 && p.y <= 3 &&
      (p.visibility === undefined || confidence(p.visibility)) && (p.presence === undefined || confidence(p.presence)));
}

// Landmarks are upright source-image coordinates. Apply the cover crop, then mirror
// only when the source-coordinate and displayed-preview conventions differ.
export function projectReadinessPoint(p: { x: number; y: number }, o: ReadinessObservation) {
  const scale = Math.max(o.previewWidth / o.sourceWidth, o.previewHeight / o.sourceHeight);
  const x = (p.x * o.sourceWidth * scale - (o.sourceWidth * scale - o.previewWidth) / 2) / o.previewWidth;
  return { x: o.coordinatesMirrored !== o.previewMirrored ? 1 - x : x,
    y: (p.y * o.sourceHeight * scale - (o.sourceHeight * scale - o.previewHeight) / 2) / o.previewHeight };
}

export function evaluateReadiness(value: unknown, policy: ReadinessPolicy = readinessPolicy): ReadinessSnapshot {
  const result: ReadinessSnapshot = { connection: unknown('pending'), fullBody: unknown('invalid'), lighting: unknown('invalid'), framing: unknown('invalid'), localObservations: 0 };
  if (!validateReadinessObservation(value)) return result;
  const o = value, calibrated = policy.calibrated[o.platform];
  result.fullBody = unknown(calibrated.fullBody ? 'no-pose' : 'uncalibrated');
  result.framing = unknown(calibrated.framing ? 'no-pose' : 'uncalibrated');
  result.lighting = unknown(calibrated.lighting ? 'uncertain' : 'uncalibrated');
  if (calibrated.lighting && policy.lightingBand && confidence(o.luminance)) {
    const luminance = o.luminance as number;
    result.lighting = luminance < policy.lightingBand[0] ? adjust('dim') : luminance > policy.lightingBand[1] ? adjust('bright') : ready();
  }
  if (!o.poseCount || o.landmarks.length !== 33) return result;
  const credible = (index: number) => {
    const p = o.landmarks[index];
    return confidence(p.visibility) && (p.visibility as number) >= policy.confidence &&
      (p.presence === undefined || p.presence >= policy.confidence);
  };
  const head = credible(0) ? [0] : policy.allowEarHead && credible(7) && credible(8) ? [7,8] : [0];
  const required = [...head,11,12,13,14,15,16,23,24,25,26,27,28,29,30,31,32];
  if (!required.every(credible)) {
    if (calibrated.fullBody) result.fullBody = unknown('uncertain');
    if (calibrated.framing) result.framing = unknown('uncertain');
    return result;
  }
  const points = required.map(index => projectReadinessPoint(o.landmarks[index], o));
  const clipped = points.some(p => p.x < policy.margin || p.x > 1-policy.margin || p.y < policy.margin || p.y > 1-policy.margin);
  if (clipped) {
    if (calibrated.fullBody) result.fullBody = adjust('clipped');
    if (calibrated.framing) result.framing = adjust('clipped');
    return result;
  }
  if (calibrated.fullBody) result.fullBody = ready();
  if (!calibrated.framing) return result;
  const angle = (a: ReadinessLandmark, b: ReadinessLandmark, c: ReadinessLandmark) => {
    const ax=(a.x-b.x)*o.sourceWidth, ay=(a.y-b.y)*o.sourceHeight;
    const cx=(c.x-b.x)*o.sourceWidth, cy=(c.y-b.y)*o.sourceHeight;
    const length=Math.hypot(ax,ay)*Math.hypot(cx,cy);
    return length > 0 ? Math.acos(Math.max(-1,Math.min(1,(ax*cx+ay*cy)/length)))*180/Math.PI : 0;
  };
  const l=o.landmarks;
  const upright = [0,1].every(side => l[11+side].y < l[23+side].y && l[23+side].y < l[25+side].y && l[25+side].y < l[27+side].y &&
    angle(l[11+side],l[23+side],l[25+side]) >= 150 && angle(l[23+side],l[25+side],l[27+side]) >= 150);
  if (!upright) { result.framing = unknown('bent'); return result; }
  const height = Math.max(...points.map(p=>p.y)) - Math.min(...points.map(p=>p.y));
  result.framing = height < policy.heightBand[0] ? adjust('too-small') : height > policy.heightBand[1] ? adjust('too-large') : ready();
  return result;
}

export function createReadinessController(policy: ReadinessPolicy = readinessPolicy) {
  let sessionId='', geometryGeneration=0, lastFrame=-1, lastObservation=-1, frameAt=-Infinity, observationAt=-Infinity;
  let state: ReadinessSnapshot;
  const since: Partial<Record<'connection' | 'fullBody' | 'lighting' | 'framing', number>> = {};
  const empty = (reason: ReadinessReason): ReadinessSnapshot => ({ connection: unknown(reason), fullBody: unknown(reason), lighting: unknown(reason), framing: unknown(reason), localObservations: 0 });
  state=empty('disabled');
  const stabilize = (key: 'connection' | 'fullBody' | 'lighting' | 'framing', check: ReadinessCheck, at: number) => {
    if (check.status !== 'ready') { delete since[key]; return check; }
    since[key] ??= at;
    return at - since[key]! >= policy.dwellMs ? check : unknown('pending');
  };
  const expire = (now: number) => {
    if (now-frameAt > policy.expiryMs || now < frameAt) { state.connection=unknown('stale'); delete since.connection; }
    if (now-observationAt > policy.expiryMs || now < observationAt) for(const key of ['fullBody','lighting','framing'] as const) {
      state[key]=unknown('stale'); delete since[key];
    }
    return {...state};
  };
  return {
    snapshot: () => ({...state}), expire,
    reset(id: string, geometry: number, reason: ReadinessReason = 'pending', now = 0) {
      sessionId=id; geometryGeneration=geometry; lastFrame=-1; lastObservation=-1; frameAt=now; observationAt=now;
      for(const key of Object.keys(since)) delete since[key as keyof typeof since];
      state=empty(reason); return {...state};
    },
    frame(frame: { sessionId: string; frameId: number; receivedAt: number }) {
      if(frame.sessionId!==sessionId || !integer(frame.frameId) || frame.frameId<=lastFrame || !Number.isFinite(frame.receivedAt) || frame.receivedAt<0 || frame.receivedAt<frameAt) return {...state};
      expire(frame.receivedAt); lastFrame=frame.frameId; frameAt=frame.receivedAt;
      state.connection=stabilize('connection',ready(),frameAt); return {...state};
    },
    observe(value: unknown, now: number) {
      const o=value as ReadinessObservation;
      if (!o || o.sessionId!==sessionId || o.geometryGeneration!==geometryGeneration) return {...state};
      if(integer(o.frameId) && o.frameId<=lastObservation) return expire(now);
      expire(now);
      const valid=validateReadinessObservation(o) && Number.isFinite(now) && o.receivedAt<=now && now-o.receivedAt<=policy.expiryMs && o.receivedAt>=observationAt;
      const evaluated=valid ? evaluateReadiness(o,policy) : empty('invalid');
      if(valid) { lastObservation=o.frameId; observationAt=o.receivedAt; state.localObservations++; }
      for(const key of ['fullBody','lighting','framing'] as const) state[key]=stabilize(key,evaluated[key],now);
      return {...state};
    },
    unavailable(reason: ReadinessReason) {
      for(const key of ['fullBody','lighting','framing'] as const) { state[key]=unknown(reason); delete since[key]; }
      observationAt=-Infinity; return {...state};
    },
  };
}

export type NativeReadinessContext = {
  mode: 'readiness'; sessionId: string; geometryGeneration: number; previewWidth: number; previewHeight: number; active: boolean;
};
export const readinessMessageLimit = 32768;
const sessionOwner=Math.random().toString(36).slice(2);
export const readinessSessionId=(generation:number)=>`camera-${sessionOwner}-${generation}`;
export function validateNativeReadinessContext(value: unknown): value is NativeReadinessContext {
  if (!value || typeof value !== 'object') return false;
  const c=value as NativeReadinessContext;
  return c.mode==='readiness' && typeof c.sessionId==='string' && c.sessionId.length>0 && c.sessionId.length<=100 &&
    integer(c.geometryGeneration) && dimension(c.previewWidth) && dimension(c.previewHeight) && typeof c.active==='boolean';
}
const readinessReasons: readonly ReadinessReason[] = ['pending','disabled','uncalibrated','no-pose','invalid','uncertain','clipped','too-small','too-large','bent','stable','stale','model-error','unsupported','interrupted','dim','bright'];
export function validateReadinessCheck(value: unknown): value is ReadinessCheck {
  if(!value || typeof value!=='object')return false;
  const c=value as ReadinessCheck;
  return ['ready','adjust','unknown'].includes(c.status) && readinessReasons.includes(c.reason) &&
    (c.status!=='ready' || c.reason==='stable') && (c.status!=='adjust' || ['clipped','too-small','too-large','dim','bright'].includes(c.reason));
}
export function readinessScript(detail: Record<string, unknown>) {
  return `(function(){window.dispatchEvent(new CustomEvent('physiquequest-camera-readiness',{detail:${JSON.stringify(detail).replace(/</g,'\\u003c')}}));})();true;`;
}

// The receiver owns freshness. Native receivedAtMs belongs to a different clock.
export function createNativeReadinessReceiver(context: NativeReadinessContext, policy: ReadinessPolicy=readinessPolicy) {
  const controller=createReadinessController(policy);
  let blocked=false, lastFrame=-1;
  const reset=(reason:ReadinessReason,now:number)=>controller.reset(context.sessionId,context.geometryGeneration,reason,now);
  reset('pending',0);
  return {
    snapshot:controller.snapshot, expire:(now:number)=>blocked?controller.snapshot():controller.expire(now),
    receive(value:unknown,now:number) {
      const invalid=()=>reset('invalid',now);
      try {
        if(typeof value==='string') {if(value.length>readinessMessageLimit)return invalid();value=JSON.parse(value);}
        else if(JSON.stringify(value)?.length>readinessMessageLimit)return invalid();
        if(!value || typeof value!=='object')return invalid();
        const e=value as Record<string,unknown>;
        if(e.sessionId!==context.sessionId || e.geometryGeneration!==context.geometryGeneration)return controller.snapshot();
        if(!Number.isFinite(now) || now<0)return invalid();
        if(['error','reset','capability'].includes(e.type as string)) {
          if(!['pending','model-error','unsupported','interrupted'].includes(e.reason as string))return invalid();
          if(blocked)return controller.snapshot();
          blocked=e.type!=='reset' || e.reason!=='pending';
          return reset(e.reason as ReadinessReason,now);
        }
        if(e.type!=='observation')return invalid();
        if(blocked)return controller.snapshot();
        const raw=e.observation as ReadinessObservation;
        if(!raw || raw.platform!=='native' || raw.sessionId!==context.sessionId || raw.geometryGeneration!==context.geometryGeneration ||
          raw.previewWidth!==context.previewWidth || raw.previewHeight!==context.previewHeight)return invalid();
        // Explicit future/nonfinite diagnostic timestamps are malformed, never freshness evidence.
        if(raw.receivedAt!==undefined && (!Number.isFinite(raw.receivedAt) || raw.receivedAt<0 || raw.receivedAt>now))return invalid();
        const observation={...raw,receivedAt:now};
        if(!validateReadinessObservation(observation) || (observation.luminance!==undefined && !confidence(observation.luminance)))return invalid();
        if(observation.frameId<=lastFrame)return controller.expire(now);
        lastFrame=observation.frameId;
        controller.frame({sessionId:context.sessionId,frameId:lastFrame,receivedAt:now});
        return controller.observe(observation,now);
      } catch {return invalid();}
    },
  };
}
