export type CameraRecoveryPhase = 'idle' | 'acquiring' | 'ready' | 'interrupted' | 'recovering' | 'failed';
export type CameraFailure = 'permission_denied' | 'no_camera' | 'timeout' | 'interrupted_too_often' | 'thermal';
export type CameraRecoveryState = { phase: CameraRecoveryPhase; attempt: number; reason?: CameraFailure };
// Engineering limits, not measured phone performance: tolerate short release
// latency while bounding retry churn and every acquisition's waiting time.
export const CAMERA_ACQUIRE_TIMEOUT_MS = 15000;
export const CAMERA_RETRY_DELAYS_MS = [500, 1000, 2000] as const;

export function cameraRecoveryMessage(s: CameraRecoveryState): string {
  if (s.phase === 'acquiring' || s.phase === 'recovering') return `Preparing camera (attempt ${s.attempt + 1}/4).`;
  if (s.phase === 'interrupted') return 'Camera interrupted. Recovery will resume when the app is active.';
  if (s.phase === 'failed') return ({permission_denied:'Camera permission denied. Allow access in settings, then try again.',no_camera:'No camera is available. Check camera access, then try again.',timeout:'Camera acquisition timed out. Try again.',interrupted_too_often:'Camera interrupted too often. Try again.',thermal:'Camera paused because the phone is too warm. Let it cool down, then try again.'})[s.reason ?? 'interrupted_too_often'];
  return s.phase === 'ready' ? 'Camera ready.' : 'Camera is off.';
}

/** One session's recovery budget; timer callbacks recheck both job and activity. */
export function createCameraRecovery(options: {
  start(ticket: number): void;
  release(): void;
  eligible(): boolean;
  changed(state: CameraRecoveryState): void;
  setTimer?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}) {
  const schedule=options.setTimer ?? setTimeout, cancel=options.clearTimer ?? clearTimeout;
  let state: CameraRecoveryState={phase:'idle',attempt:0}, wanted=false, active=true, disposed=false, ticket=0;
  let timer: ReturnType<typeof setTimeout> | null=null;
  const clear=()=>{if(timer!==null)cancel(timer);timer=null;};
  const publish=(next: CameraRecoveryState)=>{state=next;if(!disposed)options.changed({...state});};
  const allowed=()=>!disposed && wanted && active && options.eligible();
  const release=()=>{clear();ticket++;options.release();};
  const fail=(reason: CameraFailure)=>{release();publish({phase:'failed',attempt:state.attempt,reason});};
  const begin=(recovering: boolean)=>{
    if(!allowed()){publish({phase:'interrupted',attempt:state.attempt});return;}
    clear();const job=++ticket;
    publish({phase:recovering?'recovering':'acquiring',attempt:state.attempt});
    timer=schedule(()=>{timer=null;if(job!==ticket || !allowed())return;retry('timeout');},CAMERA_ACQUIRE_TIMEOUT_MS);
    options.start(job);
  };
  const retry=(reason: CameraFailure)=>{
    release();
    if(reason==='permission_denied' || reason==='no_camera' || reason==='thermal'){fail(reason);return;}
    if(!allowed()){publish({phase:'interrupted',attempt:state.attempt});return;}
    if(state.attempt>=CAMERA_RETRY_DELAYS_MS.length){fail(reason);return;}
    const delay=CAMERA_RETRY_DELAYS_MS[state.attempt],attempt=state.attempt+1,job=ticket;
    publish({phase:'recovering',attempt});
    timer=schedule(()=>{timer=null;if(job!==ticket || !allowed()){if(job===ticket)publish({phase:'interrupted',attempt});return;}begin(true);},delay);
  };
  return {
    snapshot:()=>({...state}),
    current:(job: number)=>job===ticket && allowed(),
    start(){if(disposed)return;release();wanted=true;publish({phase:'idle',attempt:0});begin(false);},
    ready(job: number){if(job!==ticket || !allowed())return;clear();publish({phase:'ready',attempt:state.attempt});},
    error(job: number, reason: CameraFailure='interrupted_too_often'){if(job!==ticket || !wanted || disposed)return;retry(reason);},
    activity(value: boolean){if(disposed || active===value)return;active=value;if(!wanted || state.phase==='failed')return;if(!value){release();publish({phase:'interrupted',attempt:state.attempt});}else retry('interrupted_too_often');},
    stop(){if(disposed)return;wanted=false;release();publish({phase:'idle',attempt:0});},
    dispose(){wanted=false;disposed=true;release();},
  };
}
