'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Home/icons';
import { api } from '../../lib/api';
import { useCameraStream } from '../../hooks/useCameraStream';
import { useCameraReadiness } from '../../hooks/useCameraReadiness';
import type { ReadinessCheck } from '../../../shared/cameraReadiness';

export default function CameraCheck({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const [mode, setMode] = useState<'live' | 'upload'>('live');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<unknown>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [exerciseHint, setExerciseHint] = useState<'' | 'chest_press' | 'squat'>('');
  const videoInputRef = useRef<HTMLInputElement>(null);
  const analysisGeneration = useRef(0);
  const [cameraMessage, setCameraMessage] = useState('');
  const [poseAvailable, setPoseAvailable] = useState(false);
  const live = useCameraStream();
  const readiness = useCameraReadiness({ videoRef: live.videoRef, frameRef: live.frameRef,
    active: mode === 'live' && live.status === 'on', native: live.nativePreview,
    generation: live.generation, generationRef: live.generationRef, mirrored: live.facing === 'front' });
  const readyCount = [readiness.connection, readiness.fullBody, readiness.lighting, readiness.framing].filter(check => check.status === 'ready').length;
  useEffect(() => { return () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }; }, [fileUrl]);
  useEffect(() => () => { analysisGeneration.current++; }, []);
  useEffect(() => {
    if (mode !== 'upload') return;
    let active = true;
    setCameraMessage('Checking recorded-video analysis availability…');
    api.getPoseStatus().then(status => {
      if (!active) return;
      setPoseAvailable(status.available);
      setCameraMessage(status.available ? 'When you choose Analyze video, the video is sent to the configured pose provider and sampled images may be sent to Google Gemini for exercise review.' : 'Pose analysis is not configured. Use the local video as a reference for manual logging.');
    }).catch(error => { if (active) setCameraMessage(error instanceof Error ? error.message : 'Could not check pose-analysis availability.'); });
    return () => { active = false; };
  }, [mode]);
  const chooseFile = (file?: File) => { if (!file) return; analysisGeneration.current++; if (fileUrl) URL.revokeObjectURL(fileUrl); setFileUrl(URL.createObjectURL(file)); setFileName(file.name); setSelectedFile(file); setDuration(null); setAnalysisBusy(false); setAnalysis(null); setAnalysisError(''); };
  const analyzeVideo = async () => {
    if (!selectedFile) return;
    if (selectedFile.size > 20 * 1024 * 1024) { setAnalysisError('Choose a video smaller than 20 MB.'); return; }
    const mimeType = selectedFile.type;
    if (mimeType !== 'video/mp4' && mimeType !== 'video/quicktime') { setAnalysisError('Choose an MP4 or MOV video.'); return; }
    if (duration === null || !Number.isFinite(duration) || duration <= 0) { setAnalysisError('Could not read video duration. Choose a playable MP4 or MOV video.'); return; }
    if (duration > 120) { setAnalysisError('Choose a video no longer than 2 minutes.'); return; }
    const generation = ++analysisGeneration.current;
    setAnalysisBusy(true); setAnalysisError('');
    try {
      const mediaBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Could not read selected video.')); reader.onload = () => resolve(String(reader.result).split(',')[1] ?? ''); reader.readAsDataURL(selectedFile); });
      const result = await api.analyzePose({ mediaBase64, mimeType, analysisType: 'workout', durationSeconds: Math.ceil(duration), ...(exerciseHint ? { exerciseHint } : {}) });
      if (analysisGeneration.current === generation) { setAnalysis(result); setReportOpen(true); }
    } catch (error) { if (analysisGeneration.current === generation) setAnalysisError(error instanceof Error ? error.message : 'Pose analysis did not complete.'); }
    finally { if (analysisGeneration.current === generation) setAnalysisBusy(false); }
  };
  const switchToUpload = () => { live.stop(true); setMode('upload'); };
  const startSession = () => { live.stop(); onStart(); };
  const continueWithoutCamera = () => { live.stop(true); onStart(); };

  if (reportOpen && analysis) return <AnalysisReport value={analysis} fileName={fileName} exerciseHint={exerciseHint} onBack={() => setReportOpen(false)} onStart={continueWithoutCamera} onRetry={() => void analyzeVideo()} retrying={analysisBusy} retryError={analysisError}/>;

  return (
    <>
      <header className="coach-header">
        <button className="coach-back" onClick={() => { live.stop(); onBack(); }} aria-label="Back to AI Coach"><Icon name="arrow" size={24}/></button>
        <h2>Camera check</h2>
      </header>

      <div className="camera-tabs" role="group" aria-label="Camera input">
        <button type="button" aria-pressed={mode==='live'} className={mode==='live'?'active':''} onClick={()=>setMode('live')}>Live feed</button>
        <button type="button" aria-pressed={mode==='upload'} className={mode==='upload'?'active':''} onClick={switchToUpload}>Upload video</button>
      </div>

      {mode === 'live' ? (
        <>
          <div ref={live.frameRef} className={`camera-preview ${live.status === 'on' ? 'camera-on' : ''}`}>
            <video className={`camera-preview-video ${live.facing === 'front' ? 'front-facing' : ''}`} ref={live.videoRef} autoPlay muted playsInline style={live.nativePreview ? { opacity: 0 } : undefined}/>
            {live.status !== 'on' && (
              <div className="camera-off">
                <button type="button" className="camera-enable" disabled={live.status === 'starting'} onClick={() => void live.start()}>
                  {live.status === 'starting' ? 'Starting camera…' : 'Enable camera'}
                </button>
              </div>
            )}
            {!live.nativePreview && (
              <button
                type="button"
                className="camera-facing-toggle"
                disabled={live.status === 'starting'}
                onClick={live.switchFacing}
                aria-label={`Switch to ${live.facing === 'back' ? 'front' : 'back'} camera`}
              >
                {live.facing === 'back' ? 'Front camera' : 'Back camera'}
              </button>
            )}
            <div className="camera-frame" aria-hidden="true">
              <span/><span/><span/><span/>
            </div>
            {live.status === 'on' && <p className="camera-distance-pill"><i aria-hidden="true"/>Approximate framing guidance</p>}
          </div>
          {live.message && <p className="camera-message" role="alert">{live.message}</p>}

          <section className="readiness-list" aria-labelledby="readiness-title" data-local-observations={readiness.localObservations}>
            <div className="section-head">
              <h3 id="readiness-title">Readiness checks</h3>
              <small role="status" aria-live="polite" aria-atomic="true">{readyCount} of 4 ready. {readiness.connection.status === 'ready' ? 'Camera frames are arriving.' : 'You can continue without the camera.'}</small>
            </div>
            <ul className="readiness-rows">
              <ReadinessRow label="Camera connection" check={live.status === 'starting' ? { status: 'unknown', reason: 'pending' } : readiness.connection} />
              <ReadinessRow label="Full body in frame" check={readiness.fullBody} />
              <ReadinessRow label="Scene brightness" check={readiness.lighting} />
              <ReadinessRow label="Framing" check={readiness.framing} />
            </ul>
            {live.status === 'on' && <button type="button" className="readiness-retry" onClick={() => void live.start()}>Retry camera checks</button>}
            <p className="camera-note">Live checks run on this device without uploading images. Body and framing guidance await device validation. Scene brightness is a coarse image estimate and cannot establish subject lighting.</p>
          </section>

          <footer className="coach-footer">
            <button className="primary" onClick={startSession}>Start session</button>
            <button className="readiness-continue" onClick={continueWithoutCamera}>Continue without camera</button>
          </footer>
        </>
      ) : (
        <>
          <div className="upload-dropzone">
            {fileUrl ? (
              <>
                <video src={fileUrl} controls playsInline onLoadedMetadata={event => setDuration(event.currentTarget.videoWidth > 0 ? event.currentTarget.duration : null)} onError={() => setDuration(null)}/>
                <b>{fileName}</b>
            <small>{poseAvailable ? 'Video is previewed locally. Submit it to request analysis.' : 'Video is previewed locally. Pose analysis is unavailable; use it as a reference for manual logging.'}</small>
                <label className="upload-exercise-hint">Exercise in this recording (optional)
                  <select value={exerciseHint} disabled={analysisBusy} onChange={event => { setExerciseHint(event.target.value as '' | 'chest_press' | 'squat'); setAnalysis(null); }}><option value="">Identify automatically</option><option value="chest_press">Chest press</option><option value="squat">Squat</option></select>
                </label>
                {poseAvailable && <button type="button" className="secondary" disabled={analysisBusy} onClick={() => void analyzeVideo()}>{analysisBusy ? 'Analyzing…' : 'Analyze video'}</button>}
                {analysisError && <p role="alert" className="error">{analysisError}</p>}
                {analysis && <button type="button" className="quiet-link" onClick={() => setReportOpen(true)}>View recording report</button>}
                <button className="quiet-link" onClick={() => { analysisGeneration.current++; URL.revokeObjectURL(fileUrl); setFileUrl(''); setFileName(''); setSelectedFile(null); setDuration(null); setAnalysisBusy(false); setAnalysis(null); setAnalysisError(''); }}>
                  Choose a different video
                </button>
              </>
            ) : (
              <>
                <button type="button" className="upload-icon" aria-label="Choose a video" onClick={() => videoInputRef.current?.click()}>
                  <Icon name="upload" size={24}/>
                </button>
                <b>Upload a recorded set</b>
                <p>MP4 or MOV, up to 2 minutes and 20 MB. Film from the side with your full body visible.</p>
              </>
            )}
          </div>
          <p className="camera-note">{cameraMessage}</p>

          <footer className="coach-footer">
            {fileUrl ? (
              <button className="primary" onClick={continueWithoutCamera}>Start manual session</button>
            ) : (
              <label className="primary choose-video">
                Choose a video
                <input ref={videoInputRef} type="file" aria-label="Choose a recorded exercise video" accept="video/mp4,video/quicktime,video/*" onChange={e => chooseFile(e.target.files?.[0])}/>
              </label>
            )}
          </footer>
        </>
      )}
    </>
  );
}

function AnalysisReport({ value, fileName, exerciseHint, onBack, onStart, onRetry, retrying, retryError }: { value: unknown; fileName: string; exerciseHint: '' | 'chest_press' | 'squat'; onBack: () => void; onStart: () => void; onRetry: () => void; retrying: boolean; retryError: string }) {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const metrics = data.metrics && typeof data.metrics === 'object' ? data.metrics as Record<string, unknown> : {};
  const sampled = typeof metrics.sampledFrames === 'number' ? metrics.sampledFrames : 0;
  const detected = typeof metrics.detectedFrames === 'number' ? metrics.detectedFrames : 0;
  const joints = Array.isArray(metrics.joints) ? metrics.joints.filter((item): item is { joint: string; minAngle: number; maxAngle: number; visibleFrames: number } => item && typeof item.joint === 'string' && typeof item.minAngle === 'number' && typeof item.maxAngle === 'number' && typeof item.visibleFrames === 'number') : [];
  const observations = Array.isArray(data.observations) ? data.observations.filter((item): item is string => typeof item === 'string') : [];
  const review = data.exerciseReview && typeof data.exerciseReview === 'object' ? data.exerciseReview as Record<string, unknown> : null;
  const movement = data.movementEstimate && typeof data.movementEstimate === 'object' ? data.movementEstimate as Record<string, unknown> : null;
  const field = (name: string) => typeof review?.[name] === 'string' ? String(review[name]) : 'Unknown';
  const items = (name: string) => Array.isArray(review?.[name]) ? (review[name] as unknown[]).filter((item): item is string => typeof item === 'string') : [];
  const seconds = typeof metrics.durationSeconds === 'number' && Number.isFinite(metrics.durationSeconds) && metrics.durationSeconds > 0 ? Math.round(metrics.durationSeconds) : null;
  const duration = seconds === null ? 'Unavailable' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return <section className="recording-report" aria-label="Video analysis">
    <header className="coach-header"><button type="button" className="coach-back" onClick={onBack} aria-label="Back to video"><Icon name="arrow" size={24}/></button><h2>Recording report</h2></header>
    <div className="recording-report-body">
      <p className="report-eyebrow">Uploaded recording</p><h1>{review && field('exercise') !== 'Unknown' ? field('exercise') : 'Movement review'}</h1><p className="report-filename">{fileName}</p>
      <div className="recording-overview">
        <div className="report-ring report-ring-unavailable" aria-label="Form accuracy unavailable"><strong>—</strong><small>form score</small></div>
        <dl><div><dt>Duration</dt><dd>{duration}</dd></div><div><dt>Estimated reps</dt><dd>{typeof movement?.estimatedReps === 'number' ? movement.estimatedReps : typeof review?.estimatedReps === 'number' ? review.estimatedReps : 'Unavailable'}</dd></div><div><dt>Correct-form reps</dt><dd>Not verified</dd></div></dl>
      </div>
      <p className="recording-note">A reliable form accuracy score and correct-form rep count are not available for this recording. {movement && 'The rep estimate uses visible joint-angle cycles and your selected exercise; check it against the video. '} {sampled > 0 ? `A pose was detected in ${detected} of ${sampled} sampled frames; this only describes visibility.` : ''} This report does not change your workout.</p>
      <section className="recording-section"><h3>Exercise in this recording</h3>
        {exerciseHint && <p className="report-muted">Selected exercise: {exerciseHint === 'chest_press' ? 'Chest press' : 'Squat'} (not verified)</p>}
        {review ? <><p className="recording-subtitle">Likely exercise: {field('exercise')}</p><dl className="recording-details"><div><dt>Equipment</dt><dd>{field('equipment')}</dd></div><div><dt>Body area</dt><dd>{field('generalBodyPart')}</dd></div><div><dt>Specific muscles</dt><dd>{field('specificMuscles')}</dd></div></dl><p className="report-muted">AI identification and repetition counts are estimates and require review.</p></> : <div className="report-card"><h3>Exercise review unavailable</h3><p>The AI provider could not complete this review. Pose measurements remain available. Try again when the service is available.</p><button type="button" className="secondary" disabled={retrying} onClick={onRetry}>{retrying ? 'Retrying analysis…' : 'Retry exercise review'}</button>{retryError && <p role="alert">{retryError}</p>}</div>}
      </section>
      {review && [['formObservations', 'Form observations'], ['corrections', 'Possible corrections'], ['instructions', 'How to perform the movement']].map(([key, title]) => <section className="recording-section" key={key}><h3>{title}</h3>{items(key).length ? <ol className="recording-feedback">{items(key).map((item, index) => <li key={index}><span aria-hidden="true">{key === 'instructions' ? index + 1 : '•'}</span><p>{item}</p></li>)}</ol> : <p className="report-muted">Not enough evidence to provide this feedback.</p>}</section>)}
      <h3>Estimated joint movement</h3><p className="report-muted">Angles are approximate and depend on the camera view and visible joints.</p>
      {joints.length ? <ul className="report-joints">{joints.map(joint => <li key={joint.joint}><span><b>{joint.joint.replace(/_/g, ' ')}</b><small>Visible in {joint.visibleFrames} sampled frames</small></span><strong>{joint.minAngle}°–{joint.maxAngle}°</strong></li>)}</ul> : <p className="report-card">Not enough visible joint data to estimate movement. Try a well-lit view with the relevant joints unobstructed.</p>}
      {observations.length > 0 && <div className="report-card"><h3>Analysis notes</h3>{observations.map((note, index) => <p key={index}>{note}</p>)}</div>}
      <div className="report-card"><h3>Review the movement</h3><p>AI feedback is unverified and may miss important details. Review the recording with a qualified coach; the analysis cannot determine whether form is safe. Stop if you experience pain.</p></div>
      <p className="report-muted">Your workout has not been changed.</p>
      <button type="button" className="primary report-action" onClick={onStart}>Start manual session</button><button type="button" className="quiet-link report-back" onClick={onBack}>Back to video</button>
    </div>
  </section>;
}

function ReadinessRow({ label, check }: { label: string; check: ReadinessCheck }) {
  const status = check.status === 'ready' ? 'Ready' : check.status === 'adjust' ? 'Adjust' : check.reason === 'pending' ? 'Checking' : 'Unavailable';
  const explanation = check.reason === 'stable' ? 'Fresh evidence received.' : check.reason === 'uncalibrated' ? 'Device validation is pending. Check your preview and continue manually.' :
    check.reason === 'pending' ? 'Waiting for fresh evidence…' : check.reason === 'model-error' ? 'Local analysis failed. Retry camera checks or continue manually.' :
    check.reason === 'unsupported' ? 'Local checks are not supported here. Continue manually.' : check.reason === 'stale' ? 'Fresh evidence expired. Retry the camera or continue manually.' :
    check.reason === 'clipped' ? 'Move back or center your whole body in the visible preview.' : check.reason === 'too-small' ? 'Approximate guidance: move closer while keeping your whole body visible.' :
    check.reason === 'too-large' ? 'Approximate guidance: move back slightly.' : check.reason === 'dim' ? 'The camera image looks dim. Try a brighter space.' :
    check.reason === 'bright' ? 'The camera image looks very bright. Reduce glare.' : check.reason === 'disabled' ? 'Enable the camera or continue without it.' :
    'A clear whole-body view is needed. Check your preview or continue manually.';
  return (
    <li className={`readiness-row ${check.status}`}>
      <span><i aria-hidden="true">{check.status === 'ready' ? <Icon name="check" size={13} /> : check.status === 'adjust' ? '!' : '?'}</i>{label}</span>
      <div className="readiness-detail"><b>{status}</b><small>{explanation}</small></div>
    </li>
  );
}
