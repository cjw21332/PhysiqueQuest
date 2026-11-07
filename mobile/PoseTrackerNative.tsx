import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { deleteAsync } from 'expo-file-system/legacy';
import { PoseTrackerProvider, usePoseTracker } from '@pose-tracker/react-native-pose-estimation-light';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import type { Keypoint } from '@pose-tracker/react-native-pose-estimation-light';
import { MAX_POSE_AGE_MS, nextFrameDelay, poseIsFresh } from './poseFrameTiming.mjs';
import { createProviderRepQuality } from './providerRepQuality.mjs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const bones = [['left_shoulder','right_shoulder'],['left_shoulder','left_elbow'],['left_elbow','left_wrist'],['right_shoulder','right_elbow'],['right_elbow','right_wrist'],['left_shoulder','left_hip'],['right_shoulder','right_hip'],['left_hip','right_hip'],['left_hip','left_knee'],['left_knee','left_ankle'],['right_hip','right_knee'],['right_knee','right_ankle']] as const;
const angles = [['left_hip','left_knee','left_ankle'],['right_hip','right_knee','right_ankle'],['left_shoulder','left_elbow','left_wrist'],['right_shoulder','right_elbow','right_wrist']] as const;

type Props = { token: string; exercise: string; name: string; close: () => void };
function Session({ token, exercise, name, close }: Props) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const alive = useRef(true);
  const [permission, setPermission] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [reps, setReps] = useState<number | null>(null);
  const quality = useRef(createProviderRepQuality());
  const [qualityCount, setQualityCount] = useState({total:0,clean:0,graded:0});
  const [status, setStatus] = useState('Preparing PoseTracker…');
  const [points, setPoints] = useState<Keypoint[]>([]);
  const [frameSize, setFrameSize] = useState({width:0,height:0});
  const [viewSize, setViewSize] = useState({width:0,height:0});
  const [form, setForm] = useState('');
  const [lastPoseAt, setLastPoseAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const { warmupExternal, startExercise, stopExercise, processFrame, configure } = usePoseTracker({
    onCounter: event => { const result=quality.current.update(event.count,event.formScore?.grade); setQualityCount(result); setReps(result.total); setForm(event.formScore?.grade ? `Last provider grade: ${event.formScore.grade}` : 'Last rep not graded'); },
    onPosture: event => setStatus(event.hint || 'Tracking active'),
    onError: () => setStatus('PoseTracker could not continue. Check the camera, connection, and account configuration.'),
  });
  useEffect(() => {
    alive.current = true;
    void Camera.requestCameraPermissionsAsync().then(p => { if (alive.current) { setPermission(p.granted); if (!p.granted) setStatus('Camera permission is blocked in phone settings.'); } });
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') close(); });
    return () => { alive.current = false; listener.remove(); };
  }, [close]);
  useEffect(() => { const timer=setInterval(()=>setClock(Date.now()),250); return ()=>clearInterval(timer); },[]);
  useEffect(() => {
    if (!permission || !cameraReady) return;
    quality.current=createProviderRepQuality();setQualityCount({total:0,clean:0,graded:0});setReps(null);setForm('');
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pump = async () => {
      if (cancelled || !camera.current) return;
      const capturedAt = Date.now();
      let original: string | undefined, resized: string | undefined;
      try {
        const photo = await camera.current.takePictureAsync({ quality: 0.25, skipProcessing: false });
        original = photo?.uri;
        if (!photo || cancelled) return;
        const factor = Math.min(1, 256 / Math.max(photo.width, photo.height));
        const image = await manipulateAsync(photo.uri, [{ resize: { width: Math.max(1, Math.round(photo.width * factor)), height: Math.max(1, Math.round(photo.height * factor)) } }], { base64: true, compress: 0.5, format: SaveFormat.JPEG });
        resized = image.uri;
        if (!cancelled && image.base64) {
          const result = await processFrame({ base64: image.base64, width: image.width, height: image.height, timestampMs: capturedAt, mirrored: facing === 'front', mime: 'image/jpeg' });
          if (!cancelled && !result.dropped) { const fresh=poseIsFresh(capturedAt,Date.now()); setPoints(fresh ? result.pose?.keypoints ?? [] : []); setLastPoseAt(fresh && result.pose ? capturedAt : 0); setFrameSize({width:image.width,height:image.height}); }
        }
      } catch { if (!cancelled) { setPoints([]); setStatus('Camera frames could not be processed. Stop and try again.'); } }
      finally { for (const uri of new Set([original, resized])) if (uri) await deleteAsync(uri, { idempotent: true }).catch(() => {}); }
      if (!cancelled) timer = setTimeout(() => void pump(), nextFrameDelay(capturedAt,Date.now()));
    };
    void (async () => {
      try {
        const configured = await configure(token);
        if (!configured) throw new Error('PoseTracker could not validate the key or plan.');
        await warmupExternal();
        if (cancelled) return;
        startExercise(exercise);
        setStatus('Waiting for you to enter the frame');
        void pump();
      } catch { if (!cancelled) setStatus('PoseTracker could not initialize. Check the camera, connection, and account configuration.'); }
    })();
    return () => { cancelled = true; if (timer) clearTimeout(timer); stopExercise(); };
  }, [permission, cameraReady, exercise, facing, token, configure, warmupExternal, startExercise, stopExercise, processFrame]);
  const scale = frameSize.width && frameSize.height ? Math.max(viewSize.width/frameSize.width,viewSize.height/frameSize.height) : 0;
  const w=frameSize.width*scale,h=frameSize.height*scale,ox=(viewSize.width-w)/2,oy=(viewSize.height-h)/2;
  const fresh = lastPoseAt > 0 && poseIsFresh(lastPoseAt,clock);
  const mapped = Object.fromEntries((fresh ? points : []).filter(p=>p.score>=0.4 && Number.isFinite(p.x) && Number.isFinite(p.y)).map(p=>[p.name,{x:ox+p.x*w,y:oy+p.y*h}]));
  const visible=Object.keys(mapped).length;
  const counter = <View style={[styles.counter, !permission && {position:'relative',top:0}]} accessible accessibilityRole="summary" accessibilityLabel={`Detected repetitions: ${reps === null ? 'waiting for tracking' : reps}. Repetitions graded A or B: ${qualityCount.clean}.`} accessibilityLiveRegion="polite">
    <View style={styles.counterColumn}><Text style={styles.counterLabel}>DETECTED REPS</Text><Text style={styles.counterValue} adjustsFontSizeToFit numberOfLines={1}>{reps === null ? '—' : reps}</Text></View>
    <View style={styles.counterDivider}/><View style={styles.counterColumn}><Text style={styles.counterLabel}>GRADED A / B</Text><Text style={styles.counterValue} adjustsFontSizeToFit numberOfLines={1}>{qualityCount.clean}</Text></View>
  </View>;
  return <View style={[styles.root,{paddingTop:Math.max(16,insets.top+8),paddingBottom:Math.max(16,insets.bottom+8)}]}><Text style={styles.title} numberOfLines={1}>{name}</Text><Text style={styles.text} numberOfLines={2}>PoseTracker · {status}</Text>
    {permission && <View style={styles.camera} onLayout={event=>setViewSize(event.nativeEvent.layout)}><CameraView key={facing} ref={camera} facing={facing} mirror={facing === 'front'} style={StyleSheet.absoluteFill} onCameraReady={() => setCameraReady(true)} onMountError={() => setStatus('Camera unavailable. Close other camera apps and retry.')} />
      <Svg pointerEvents="none" width={viewSize.width} height={viewSize.height} style={StyleSheet.absoluteFill}>
        {bones.map(([a,b])=>mapped[a]&&mapped[b]?<Line key={`${a}-${b}`} x1={mapped[a].x} y1={mapped[a].y} x2={mapped[b].x} y2={mapped[b].y} stroke="#22e9c0" strokeWidth={4}/>:null)}
        {Object.entries(mapped).map(([name,p])=><Circle key={name} cx={p.x} cy={p.y} r={5} fill="#fff" stroke="#22e9c0" strokeWidth={3}/>)}
        {angles.map(([a,b,c])=>{const p=mapped[a],q=mapped[b],r=mapped[c];if(!p||!q||!r)return null;const u=Math.hypot(p.x-q.x,p.y-q.y),v=Math.hypot(r.x-q.x,r.y-q.y);if(!u||!v)return null;const value=Math.round(Math.acos(Math.max(-1,Math.min(1,((p.x-q.x)*(r.x-q.x)+(p.y-q.y)*(r.y-q.y))/(u*v))))*180/Math.PI);return <SvgText key={b} x={q.x+8} y={q.y-8} fill="#ffd84c" fontSize={13} fontWeight="bold">{value}°</SvgText>;})}
      </Svg>{counter}</View>}
    {!permission && counter}
    <Text style={styles.text}>{visible >= 5 ? 'Body points detected · overlay is approximate' : lastPoseAt && clock-lastPoseAt>MAX_POSE_AGE_MS ? 'Tracking delayed · keep the camera steady' : 'Body not detected yet · stand back in good light'}</Text>
    <Text style={styles.text}>{form || 'Waiting for a provider-graded repetition'} · {qualityCount.graded} graded</Text>
    <View style={styles.actions}><Pressable style={styles.button} onPress={() => { setPoints([]); setCameraReady(false); setFacing(value => value === 'front' ? 'back' : 'front'); }}><Text>Switch camera</Text></Pressable><Pressable style={styles.button} onPress={close}><Text>Stop tracking</Text></Pressable></View>
    <Text style={styles.text}>A/B counts use PoseTracker grades. They are experimental and do not prove correct or safe form. Ungraded reps are not included.</Text>
  </View>;
}
export default function PoseTrackerNative({ token, ...props }: Props) {
  return <PoseTrackerProvider apiToken={token}><Session token={token} {...props} /></PoseTrackerProvider>;
}
const styles = StyleSheet.create({ root: { position:'absolute',top:0,bottom:0,left:0,right:0, zIndex: 50, elevation: 50, backgroundColor: '#0b0f15', paddingHorizontal: 16, gap: 8 }, title: { color: '#fff', fontSize: 20, fontWeight: '700' }, text: { color: '#fff', fontSize: 13 }, camera: { flex: 1, minHeight: 140, borderRadius: 16, overflow: 'hidden' }, counter: { position:'absolute', top:12, alignSelf:'center', flexDirection:'row', alignItems:'center', backgroundColor:'#101820ed', borderWidth:1, borderColor:'#65dcbc', borderRadius:16, paddingHorizontal:14, paddingVertical:8, minWidth:210, zIndex:3 }, counterColumn: { flex:1, alignItems:'center', minWidth:80 }, counterDivider: { width:1, height:38, backgroundColor:'#719189', marginHorizontal:10 }, counterLabel: { color:'#c6e5dc', fontSize:10, fontWeight:'700', letterSpacing:0.5 }, counterValue: { color:'#ffffff', fontSize:34, lineHeight:40, fontWeight:'800', fontVariant:['tabular-nums'] }, actions: { flexDirection: 'row', gap: 12 }, button: { backgroundColor: '#22c55e', padding: 14, borderRadius: 12 } });
