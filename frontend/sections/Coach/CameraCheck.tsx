'use client';

import { useEffect, useState } from 'react';
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
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [cameraMessage, setCameraMessage] = useState('');
  const [poseAvailable, setPoseAvailable] = useState(false);
  const live = useCameraStream();
  const readiness = useCameraReadiness({ videoRef: live.videoRef, frameRef: live.frameRef,
    active: mode === 'live' && live.status === 'on', native: live.nativePreview,
    generation: live.generation, generationRef: live.generationRef, mirrored: live.facing === 'front' });
  const readyCount = [readiness.connection, readiness.fullBody, readiness.lighting, readiness.framing].filter(check => check.status === 'ready').length;
  useEffect(() => { return () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }; }, [fileUrl]);
  useEffect(() => {
    if (mode !== 'upload') return;
    let active = true;
    setCameraMessage('Checking recorded-video analysis availability…');
    api.getPoseStatus().then(status => {
      if (!active) return;
      setPoseAvailable(status.available);
      setCameraMessage(status.available ? 'Selected video is sent only when you choose Analyze video.' : 'Pose analysis is not configured. Use the local video as a reference for manual logging.');
    }).catch(error => { if (active) setCameraMessage(error instanceof Error ? error.message : 'Could not check pose-analysis availability.'); });
    return () => { active = false; };
  }, [mode]);
  const chooseFile = (file?: File) => { if (!file) return; if (fileUrl) URL.revokeObjectURL(fileUrl); setFileUrl(URL.createObjectURL(file)); setFileName(file.name); setSelectedFile(file); setAnalysis(null); setAnalysisError(''); };
  const analyzeVideo = async () => {
    if (!selectedFile) return;
    if (selectedFile.size > 20 * 1024 * 1024) { setAnalysisError('Choose a video smaller than 20 MB.'); return; }
    const mimeType = selectedFile.type;
    if (mimeType !== 'video/mp4' && mimeType !== 'video/quicktime') { setAnalysisError('Choose an MP4 or MOV video.'); return; }
    setAnalysisBusy(true); setAnalysisError('');
    try {
      const mediaBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Could not read selected video.')); reader.onload = () => resolve(String(reader.result).split(',')[1] ?? ''); reader.readAsDataURL(selectedFile); });
      const result = await api.analyzePose({ mediaBase64, mimeType });
      setAnalysis(result);
    } catch (error) { setAnalysisError(error instanceof Error ? error.message : 'Pose analysis did not complete.'); }
    finally { setAnalysisBusy(false); }
  };
  const switchToUpload = () => { live.stop(true); setMode('upload'); };
  const startSession = () => { live.stop(); onStart(); };
  const continueWithoutCamera = () => { live.stop(true); onStart(); };

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
                <video src={fileUrl} controls/>
                <b>{fileName}</b>
            <small>{poseAvailable ? 'Video is previewed locally. Submit it to request analysis.' : 'Video is previewed locally. Pose analysis is unavailable; use it as a reference for manual logging.'}</small>
                {poseAvailable && <button type="button" className="secondary" disabled={analysisBusy} onClick={() => void analyzeVideo()}>{analysisBusy ? 'Analyzing…' : 'Analyze video'}</button>}
                {analysisError && <p role="alert" className="error">{analysisError}</p>}
                {analysis && <pre className="pose-analysis-result">{JSON.stringify(analysis, null, 2)}</pre>}
                <button className="quiet-link" onClick={() => { URL.revokeObjectURL(fileUrl); setFileUrl(''); setFileName(''); setSelectedFile(null); setAnalysis(null); setAnalysisError(''); }}>
                  Choose a different video
                </button>
              </>
            ) : (
              <>
                <span className="upload-icon">
                  <Icon name="upload" size={24}/>
                </span>
                <b>Upload a recorded set</b>
                <p>MP4 or MOV, up to 2 minutes. Film from the side with your full body visible.</p>
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
                <input type="file" aria-label="Choose a recorded exercise video" accept="video/mp4,video/quicktime,video/*" onChange={e => chooseFile(e.target.files?.[0])}/>
              </label>
            )}
          </footer>
        </>
      )}
    </>
  );
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
