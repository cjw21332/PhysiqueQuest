from pathlib import Path
import difflib

ROOT = Path.cwd()
PAYLOAD = ROOT / "patches/files"


def edit(name, changes):
    original = (ROOT / name).read_text(encoding="utf-8")
    result = original
    for old, new in changes:
        if result.count(old) != 1:
            raise ValueError(f"Expected one source anchor in {name}: {old[:80]!r}")
        result = result.replace(old, new, 1)
    target = PAYLOAD / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(result, encoding="utf-8")


edit("frontend/hooks/useGenericRepTracking.ts", [
    ("import { createExerciseCounter, type PatternId, type ExerciseConfigOverride }", "import { createMovementTelemetry, type MovementTelemetry } from '../../shared/movementTelemetry';\nimport { createExerciseCounter, resolvePatternSpec, type PatternId, type ExerciseConfigOverride }"),
    ("exerciseName?: string) {", "exerciseName?: string, visualOptions = { skeleton: true, guides: true }, cameraGeneration = 0) {\n  const visualRef = useRef(visualOptions); visualRef.current = visualOptions;\n  const geometryRef = useRef(cameraGeneration); geometryRef.current = cameraGeneration;\n  const movement = useMemo(() => { const spec = pattern ? resolvePatternSpec(pattern, override) : null; return createMovementTelemetry(spec?.startThreshold, spec?.peakThreshold, spec ? spec.mode === 'bilateral' : config.sideMode === 'bilateral'); }, [pattern, override, config.sideMode]);\n  const [motion, setMotion] = useState<MovementTelemetry>(() => movement.snapshot());\n  const resetMotion = () => { movement.reset(); setMotion(movement.snapshot()); };"),
    ("repCount: snapshot.reps, partialCount:", "measurementVisible: snapshot.visible, repCount: snapshot.reps, partialCount:"),
    ("    if (!active) return;", "    movement.reset(); setMotion(movement.snapshot());\n    if (!active) return;"),
    ("    const filter = createLandmarkFilter(true);", "    const filter = createLandmarkFilter(true);\n    let visualGeneration = geometryRef.current, lastMotionUi = 0;"),
    ("        const pose = event.data.frame as PoseFrame;", "        const pose = event.data.frame as PoseFrame;\n        if (event.data.subjectChanged || visualGeneration !== geometryRef.current) { movement.reset(); filter.reset(); visualGeneration = geometryRef.current; }\n        const next = counter.update(pose);\n        const points = filter.update(pose.landmarks, pose.timestamp);\n        const measured = 'measurementVisible' in next ? Boolean(next.measurementVisible) : next.currentAngle !== null && next.state !== 'VISIBILITY_LOST';\n        const observed = movement.update({ ...pose, landmarks: points, progress: next.currentProgress, visible: measured, reps: next.repCount, partials: next.partialCount });\n        if (performance.now() - lastMotionUi >= 200) { setMotion(observed); lastMotionUi = performance.now(); }"),
    ("          const points = filter.update(pose.landmarks, pose.timestamp);", "          // Guides observe the same selected person as the counter."),
    ("            const first = points[a], second = points[b];", "            if (!visualRef.current.skeleton) break;\n            const first = points[a], second = points[b];"),
    ("          context.stroke();\n        }\n        setProgress(counter.update(event.data.frame as PoseFrame));", "          context.stroke();\n          if (visualRef.current.guides && observed.point) {\n            const project = (p: { x: number; y: number }) => ({ x: ox + p.x * video.videoWidth * scale, y: oy + p.y * video.videoHeight * scale });\n            if (observed.reference) {\n              const reference = project(observed.reference);\n              context.setLineDash([5, 7]); context.strokeStyle = '#ffffff80'; context.lineWidth = 1;\n              context.beginPath(); context.moveTo(reference.x, 0); context.lineTo(reference.x, canvas.height); context.stroke(); context.setLineDash([]);\n            }\n            context.strokeStyle = '#ffd580'; context.lineWidth = 2; context.beginPath();\n            observed.path.forEach((point, index) => { const p = project(point); if (index) context.lineTo(p.x, p.y); else context.moveTo(p.x, p.y); }); context.stroke();\n            const point = project(observed.point); context.fillStyle = '#fff'; context.beginPath(); context.arc(point.x, point.y, 4, 0, Math.PI * 2); context.fill();\n          }\n        }\n        setProgress(next);"),
    ("        setProgress(counter.tick(now));", "        setProgress(counter.tick(now));\n        movement.reset(); setMotion(movement.snapshot());"),
    ("  },[active,counter,videoRef]);", "  },[active,counter,videoRef,movement]);"),
    ("return { ...progress, status, powerNotice, overlayRef };", "return { ...progress, status, powerNotice, overlayRef, motion, resetMotion };")
])

edit("frontend/sections/Coach/GenericTrackingSession.tsx", [
    ("import type { PatternId, ExerciseConfigOverride }", "import { movementPhaseLabels } from '../../../shared/movementTelemetry';\nimport { patternSpec, type PatternId, type ExerciseConfigOverride }"),
    ("  const [summary,setSummary]=useState({reps:0,partial:0});", "  const [summary,setSummary]=useState({reps:0,partial:0});\n  const [visualOptions,setVisualOptions]=useState({skeleton:true,guides:true});\n  const phaseLabels=movementPhaseLabels(pattern);\n  const hold=pattern ? patternSpec(pattern).mode==='hold' : false;"),
    ("camera.videoRef,pattern,override,name);", "camera.videoRef,pattern,override,name,visualOptions,camera.generation);\n  const timing=tracking.motion.current ?? tracking.motion.last;"),
    (" />{camera.status!=='on'&&<div className=\"generic-camera-placeholder\">", " />{camera.status==='on'&&<div className=\"motion-rep-hud\" aria-live=\"polite\" aria-atomic=\"true\"><strong>{hold?(tracking.holdDurationMs/1000).toFixed(1):tracking.repCount}</strong><span>{hold?'seconds':'complete reps'}</span>{!hold&&<small>{tracking.partialCount} partial</small>}</div>}{camera.status!=='on'&&<div className=\"generic-camera-placeholder\">"),
    ("      <div className=\"generic-tracking-status\"", "      <div className=\"motion-guide-controls\"><label><input type=\"checkbox\" checked={visualOptions.skeleton} onChange={event=>setVisualOptions(current=>({...current,skeleton:event.target.checked}))}/>Skeleton</label><label><input type=\"checkbox\" checked={visualOptions.guides} onChange={event=>setVisualOptions(current=>({...current,guides:event.target.checked}))}/>Body path</label><button type=\"button\" className=\"secondary\" onClick={tracking.resetMotion}>Reset reference</button></div>\n      {!hold&&<div className=\"motion-timing-row\" aria-label=\"Sampled repetition timing\">{phaseLabels.map((label,index)=><div key={label}><span>{label}</span><strong>{timing?`${([timing.moveMs,timing.holdMs,timing.returnMs][index]/1000).toFixed(1)}s`:'—'}</strong></div>)}</div>}\n      <p className=\"generic-tracking-note\">The dashed line marks your starting screen position. Timing uses visible samples.</p>\n      <div className=\"generic-tracking-status\"")
])

css = """
.motion-rep-hud{position:absolute;left:16px;bottom:16px;display:grid;color:#fff;text-shadow:0 2px 12px #000;pointer-events:none}.motion-rep-hud strong{font-size:clamp(48px,12vw,78px);line-height:1;font-variant-numeric:tabular-nums}.motion-rep-hud span{font-size:13px;font-weight:700}.motion-rep-hud small{font-size:12px;margin-top:4px}.motion-guide-controls{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:12px}.motion-guide-controls label{display:flex;align-items:center;gap:6px;font-size:13px}.motion-timing-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:12px 0}.motion-timing-row div{display:grid;gap:4px}.motion-timing-row span{font-size:12px;color:var(--muted)}.motion-timing-row strong{font-size:20px;font-variant-numeric:tabular-nums}
"""
name = "frontend/sections/Coach/posetracker.css"
(PAYLOAD/name).write_text((ROOT/name).read_text(encoding="utf-8") + css, encoding="utf-8")

edit("mobile/PoseTrackerNative.tsx", [
    ("import { POSE_HOLD_MS }", "import { createMovementTelemetry, movementPhaseLabels, type MovementTelemetry } from '../shared/movementTelemetry';\nimport { POSE_HOLD_MS }"),
    ("  patternSpec,\n  targetFps,", "  patternSpec,\n  resolvePatternSpec,\n  targetFps,"),
    ("  const skeletonPath = useSharedValue('');", "  const [showSkeleton, setShowSkeleton] = useState(true);\n  const [showGuides, setShowGuides] = useState(true);\n  const [motion, setMotion] = useState<MovementTelemetry>(() => createMovementTelemetry().snapshot());\n  const trailPath = useSharedValue(''), referencePath = useSharedValue(''), markerPath = useSharedValue('');\n  const animatedTrail = useAnimatedProps(() => ({ d: trailPath.value }));\n  const animatedReference = useAnimatedProps(() => ({ d: referencePath.value }));\n  const animatedMarker = useAnimatedProps(() => ({ d: markerPath.value }));\n  const skeletonPath = useSharedValue('');"),
    ("  const patternId: PatternId = isPatternId(pattern) ? pattern : 'squat';", "  const patternId: PatternId = isPatternId(pattern) ? pattern : 'squat';\n  const movement = useMemo(() => { const spec = resolvePatternSpec(patternId, override); return createMovementTelemetry(spec.startThreshold, spec.peakThreshold, spec.mode === 'bilateral'); }, [patternId, override]);\n  const clearMovement = () => { movement.reset(); setMotion(movement.snapshot()); trailPath.value = ''; referencePath.value = ''; markerPath.value = ''; };"),
    ("    setSnapshot(null);\n    setStatus('Waiting for you to enter the frame');", "    setSnapshot(null);\n    clearMovement();\n    setStatus('Waiting for you to enter the frame');"),
    ("    landmarkFilter.reset();\n    stableSegments.current.reset();", "    landmarkFilter.reset();\n    clearMovement();\n    stableSegments.current.reset();"),
    ("    const next = counter.current.update({ landmarks: measurementJoints, timestamp: ts, aspect });", "    const next = counter.current.update({ landmarks: measurementJoints, timestamp: ts, aspect });\n    const observed = movement.update({ timestamp: ts, aspect, landmarks: frame.joints, progress: next.progress, visible: next.visible, reps: next.reps, partials: next.partials });\n    if (frame.width && frame.height && viewSize.width && viewSize.height && observed.point) {\n      const scale = Math.max(viewSize.width / frame.width, viewSize.height / frame.height);\n      const ox = (viewSize.width - frame.width * scale) / 2, oy = (viewSize.height - frame.height * scale) / 2;\n      const project = (p: { x: number; y: number }) => ({ x: ox + p.x * frame.width! * scale, y: oy + p.y * frame.height! * scale });\n      trailPath.value = observed.path.map((p, index) => { const point = project(p); return `${index ? 'L' : 'M'}${point.x},${point.y}`; }).join('');\n      const reference = observed.reference ? project(observed.reference) : null;\n      referencePath.value = reference ? `M${reference.x},0L${reference.x},${viewSize.height}` : '';\n      const point = project(observed.point); markerPath.value = `M${point.x},${point.y}l0.01,0`;\n    } else { trailPath.value = ''; referencePath.value = ''; markerPath.value = ''; }"),
    ("    setSnapshot(next);", "    setMotion(observed);\n    setSnapshot(next);"),
    ("  const primaryValue = hold ?", "  const phaseLabels = movementPhaseLabels(patternId);\n  const timing = motion.current ?? motion.last;\n  const primaryValue = hold ?"),
    ("            <AnimatedPath animatedProps={animatedSkeleton} fill=\"none\" stroke=\"#22e9c0\" strokeWidth={3} />\n            <AnimatedPath animatedProps={animatedFault} fill=\"none\" stroke=\"#ff3434\" strokeWidth={6} />", "            {showSkeleton && <AnimatedPath animatedProps={animatedSkeleton} fill=\"none\" stroke=\"#22e9c0\" strokeWidth={3} />}\n            {showSkeleton && <AnimatedPath animatedProps={animatedFault} fill=\"none\" stroke=\"#ff3434\" strokeWidth={6} />}\n            {showGuides && <AnimatedPath animatedProps={animatedReference} fill=\"none\" stroke=\"#ffffff80\" strokeWidth={1} strokeDasharray=\"5 7\"/>}\n            {showGuides && <AnimatedPath animatedProps={animatedTrail} fill=\"none\" stroke=\"#ffd580\" strokeWidth={2}/>}\n            {showGuides && <AnimatedPath animatedProps={animatedMarker} fill=\"none\" stroke=\"#fff\" strokeWidth={8} strokeLinecap=\"round\"/>}"),
    ("      <View style={styles.stats}>", "      <View style={styles.guideControls}>\n        <Pressable accessibilityRole=\"button\" accessibilityState={{selected:showSkeleton}} onPress={()=>setShowSkeleton(value=>!value)}><Text style={styles.text}>Skeleton {showSkeleton?'on':'off'}</Text></Pressable>\n        <Pressable accessibilityRole=\"button\" accessibilityState={{selected:showGuides}} onPress={()=>setShowGuides(value=>!value)}><Text style={styles.text}>Body path {showGuides?'on':'off'}</Text></Pressable>\n        <Pressable accessibilityRole=\"button\" onPress={clearMovement}><Text style={styles.text}>Reset reference</Text></Pressable>\n      </View>\n      {!hold&&<View style={styles.guideControls} accessibilityLabel=\"Sampled repetition timing\">{phaseLabels.map((label,index)=><Text key={label} style={styles.text}>{label}: {timing?`${([timing.moveMs,timing.holdMs,timing.returnMs][index]/1000).toFixed(1)}s`:'—'}</Text>)}</View>}\n      <Text style={styles.text}>The dashed line marks your starting screen position.</Text>\n      <View style={styles.stats}>"),
    ("  stats: { gap: 2 },", "  guideControls: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, flexWrap: 'wrap' },\n  stats: { gap: 2 },")
])

# Preserve runtime state: delayed/missing frames must not leave a stationary
# path that appears to be a current measurement. This affects only the overlay.
native = PAYLOAD/"mobile/PoseTrackerNative.tsx"
text = native.read_text(encoding="utf-8")
for anchor in ["      setStatus('Show the working joints clearly.');", "    if (!fullBodyVisible) {"]:
    replacement = anchor + "\n      clearMovement();" if anchor.endswith("{") else "      clearMovement();\n" + anchor
    if text.count(anchor) != 1:
        raise ValueError(anchor)
    text = text.replace(anchor, replacement, 1)
native.write_text(text, encoding="utf-8")

# Fade last-observed guides after delivery stalls; never hold a current marker
# indefinitely when inference/camera frames stop arriving.
text = native.read_text(encoding="utf-8")
text = text.replace("  const trailPath = useSharedValue('')", "  const motionOpacity = useSharedValue(0);\n  const trailPath = useSharedValue('')", 1)
text = text.replace("({ d: trailPath.value })", "({ d: trailPath.value, opacity: motionOpacity.value })", 1)
text = text.replace("({ d: referencePath.value })", "({ d: referencePath.value, opacity: motionOpacity.value })", 1)
text = text.replace("({ d: markerPath.value })", "({ d: markerPath.value, opacity: motionOpacity.value })", 1)
text = text.replace("const clearMovement = () => { movement.reset();", "const clearMovement = () => { cancelAnimation(motionOpacity); motionOpacity.value = 0; movement.reset();", 1)
text = text.replace("if (frame.width && frame.height && viewSize.width && viewSize.height && observed.point) {", "if (frame.width && frame.height && viewSize.width && viewSize.height && observed.point) {\n      cancelAnimation(motionOpacity); motionOpacity.value = 1; motionOpacity.value = withDelay(350, withTiming(0, { duration: 150 }));", 1)
text = text.replace("counter: { position: 'absolute', top: 10,", "counter: { position: 'absolute', bottom: 10,", 1)
text = text.replace("counterValue: { color: '#fff', fontSize: 30, lineHeight: 36,", "counterValue: { color: '#fff', fontSize: 42, lineHeight: 48,", 1)
native.write_text(text, encoding="utf-8")

def patch(name, files):
    chunks = []
    for file in files:
        current = (ROOT/file).read_text(encoding="utf-8") if (ROOT/file).exists() else None
        proposed = (PAYLOAD/file).read_text(encoding="utf-8")
        header = f"diff --git a/{file} b/{file}\n" + ("new file mode 100644\n" if current is None else "")
        chunks.append(header + ''.join(difflib.unified_diff([] if current is None else current.splitlines(True), proposed.splitlines(True), fromfile='/dev/null' if current is None else f'a/{file}', tofile=f'b/{file}')))
    (ROOT/"patches"/name).write_text(''.join(chunks), encoding="utf-8")

patch("0005-reference-motion-telemetry.patch", ["shared/movementTelemetry.ts", "shared/__tests__/movementTelemetry.spec.ts"])
patch("0006-reference-tracker-overlays.patch", ["frontend/hooks/useGenericRepTracking.ts", "frontend/sections/Coach/GenericTrackingSession.tsx", "frontend/sections/Coach/posetracker.css", "mobile/PoseTrackerNative.tsx"])
print("Prepared display-only candidate patches 0005–0006; app source unchanged.")
