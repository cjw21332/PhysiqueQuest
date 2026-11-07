import { canTrack, providerExercises, type TrackingConfig } from '../../../backend/src/pose-tracker/exercise-registry';
export const poseTrackerOrigin = 'https://app.posetracker.com';
export function safeProviderError(code: string): string {
  if (code === 'NotAllowedError') return 'Camera permission denied. Check your camera settings.';
  if (code === 'NotReadableError') return 'Camera disconnected or unavailable. Reconnect it and retry.';
  if (code === 'backend_fallback_cpu') return 'Tracking switched to CPU processing.';
  if (code === 'backend_fallback_wasm') return 'Tracking switched to WebAssembly processing.';
  return 'PoseTracker could not continue. Check the camera, connection, and account configuration, then retry.';
}
export function trackingUrl(config: TrackingConfig, token: string, developerOutputs = false, adminTest = false, androidWebView = false) {
  if (!token.trim()) throw Error('PoseTracker token is missing');
  if (!canTrack(config) && !(adminTest && config.validationStatus !== 'disabled' && config.trackingMode !== 'unavailable')) throw Error('Tracking configuration is not ready');
  if (config.referenceUuid && config.providerExerciseId) throw Error('Exercise and reference cannot be combined');
  const url = new URL('/pose_tracker/tracking', poseTrackerOrigin);
  url.searchParams.set('token',token.trim());
  if (config.trackingMode === 'builtin' && providerExercises.includes(config.providerExerciseId as typeof providerExercises[number])) url.searchParams.set('exercise',config.providerExerciseId!);
  else if (config.trackingMode === 'reference' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.referenceUuid ?? '')) url.searchParams.set('reference',config.referenceUuid!);
  else throw Error('Invalid provider configuration');
  url.searchParams.set('skeleton','true');
  if(androidWebView)url.searchParams.set('isAndroid','true');
  if (developerOutputs) for (const name of ['keypoints','angles','progression','recommendations']) url.searchParams.set(name,'true');
  return url.toString();
}
type Scores = Record<string, number | string>;
export type ProviderEvent =
  | { type: 'initialization'; ready: boolean; message: string }
  | { type: 'counter'; count: number; form?: Scores; reference?: Scores }
  | { type: 'progression'; value: number }
  | { type: 'recommendations'; messages: string[] }
  | { type: 'posture'; ready: boolean; message: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'form_score'; form: Scores }
  | { type: 'keypoints' | 'angles'; data: unknown }
  | { type: 'exercise_summary'; count: number };
const object = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
const number = (x: unknown, min = 0, max = 1e6): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const string = (x: unknown): x is string => typeof x === 'string' && x.length <= 2000;
function scores(value: unknown, reference = false): Scores | undefined {
  if (!object(value)) return;
  const result: Scores = {};
  for (const key of reference ? ['overallScore','nccScore','dtwScore','timingScore','distScore'] : ['score','avg_score']) if (number(value[key],0,100)) result[key] = value[key];
  if (typeof value.grade === 'string' && /^[A-F]$/.test(value.grade)) result.grade=value.grade;
  return Object.keys(result).length ? result : undefined;
}
export function normalizeProviderEvent(raw: unknown): ProviderEvent | null {
  try {
    if (typeof raw === 'string') { if(raw.length>65536) return null; raw=JSON.parse(raw); }
    if (!object(raw)) return null;
    switch(raw.type) {
      case 'initialization': return string(raw.message) && (raw.ready === undefined || typeof raw.ready === 'boolean') ? { type:'initialization',ready:raw.ready===true,message:raw.message } : null;
      case 'counter': return number(raw.current_count) && Number.isInteger(raw.current_count) ? { type:'counter',count:raw.current_count,form:scores(raw.form_score),reference:scores(raw.reference_score,true) } : null;
      case 'form_score': { const form=scores(raw); return form ? {type:'form_score',form}:null; }
      case 'progression': return number(raw.value,0,100) ? {type:'progression',value:raw.value}:null;
      case 'recommendations': return Array.isArray(raw.data) && raw.data.length<=30 && raw.data.every(string) ? {type:'recommendations',messages:raw.data}:null;
      case 'posture': return typeof raw.ready==='boolean' && string(raw.message) ? {type:'posture',ready:raw.ready,message:raw.message}:null;
      case 'error': return string(raw.error) && string(raw.message) ? {type:'error',code:raw.error,message:raw.message}:null;
      case 'keypoints': return Array.isArray(raw.data) && raw.data.length<=33 && raw.data.every((p:unknown)=>object(p)&&string(p.name)&&number(p.x,0,1)&&number(p.y,0,1)&&number(p.score,0,1)) ? {type:'keypoints',data:raw.data}:null;
      case 'angles': { const data=raw.data; return object(data) && ['left_side','right_side'].every(side=>object(data[side]) && Object.keys(data[side]).length<=30 && Object.values(data[side]).every(v=>number(v,0,360))) ? {type:'angles',data}:null; }
      case 'exercise_summary': return number(raw.counter) && Number.isInteger(raw.counter) ? {type:'exercise_summary',count:raw.counter}:null;
      default: return null;
    }
  } catch { return null; }
}
export function trustedProviderEvent(event: Pick<MessageEvent,'origin'|'source'|'data'>, source: Window | null) {
  return source && event.source === source && event.origin === poseTrackerOrigin ? normalizeProviderEvent(event.data) : null;
}
export type TrackingState = { status: string; ready: boolean; count?: number; progression?: number; feedback: string[]; form?: Scores; reference?: Scores; angles?: unknown; error?: string };
export const initialTrackingState = (): TrackingState => ({status:'Loading PoseTracker',ready:false,feedback:[]});
export function reduceProviderEvent(state: TrackingState, event: ProviderEvent): TrackingState {
  if (event.type === 'error') return ['backend_fallback_wasm','backend_fallback_cpu'].includes(event.code) ? {...state,feedback:[safeProviderError(event.code)]} : {...state,ready:false,status:'Provider unavailable',error:safeProviderError(event.code)};
  if (event.type === 'initialization') return {...state,ready:event.ready,status:event.ready?'Waiting for the user to enter the frame':/webcam/i.test(event.message)?'Waiting for camera permission':'Initializing tracking'};
  if (!state.ready) return state;
  if (event.type === 'angles') return {...state,angles:event.data};
  if (event.type === 'posture') return {...state,status:event.ready?'Tracking active':'Waiting for the user to enter the frame',feedback:[event.message]};
  if (event.type === 'counter') return {...state,count:event.count,status:event.count>(state.count??0)?'Repetition completed':'Tracking active',form:event.form??state.form,reference:event.reference??state.reference};
  if (event.type === 'progression') return {...state,progression:event.value,status:'Movement detected'};
  if (event.type === 'recommendations') return {...state,feedback:event.messages,status:'Feedback available'};
  if (event.type === 'form_score') return {...state,form:event.form,status:'Feedback available'};
  if (event.type === 'exercise_summary') return {...state,count:event.count,status:'Session completed'};
  return state;
}
