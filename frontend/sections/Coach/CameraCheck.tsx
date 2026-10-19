'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Home/icons';
import { api } from '../../lib/api';
import { useCameraStream } from '../../hooks/useCameraStream';
import { parseCameraReadiness, readyCheckCount, type CameraReadiness, type ReadinessCheck } from '../../lib/cameraReadiness';

export default function CameraCheck({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const [mode, setMode] = useState<'live' | 'upload'>('live');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<unknown>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [cameraMessage, setCameraMessage] = useState('Checking pose-analysis service…');
  const [poseAvailable, setPoseAvailable] = useState(false);
  const [liveReadiness, setLiveReadiness] = useState<CameraReadiness | null>(null);
  const [readinessBusy, setReadinessBusy] = useState(false);
  const [readinessError, setReadinessError] = useState('');
  const readinessRequestRef = useRef(0);
  const live = useCameraStream();
  useEffect(() => { return () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }; }, [fileUrl]);
  useEffect(() => { let active = true; api.getPoseStatus().then(status => { if (!active) return; setPoseAvailable(status.available); setCameraMessage(status.available ? 'Live framing, lighting, and distance checks use the configured pose-analysis service.' : 'Pose analysis is not configured. Camera preview is available, but framing, lighting, and distance cannot be verified.'); }).catch(error => { if (active) setCameraMessage(error instanceof Error ? error.message : 'Could not check pose-analysis availability.'); }); return () => { active = false; }; }, []);
  const analyzeReadiness = useCallback(async () => {
    const requestId = ++readinessRequestRef.current;
    setReadinessBusy(true);
    setReadinessError('');
    setLiveReadiness(null);
    try {
      const mediaBase64 = await live.captureFrame();
      const analysis = await api.analyzePose({
        mediaBase64,
        mimeType: 'image/jpeg',
        analysisType: 'readiness',
        requestedChecks: ['fullBodyInFrame', 'lighting', 'distance'],
      });
      if (requestId === readinessRequestRef.current) setLiveReadiness(parseCameraReadiness(analysis));
    } catch (error) {
      if (requestId === readinessRequestRef.current) {
        setReadinessError(error instanceof Error ? error.message : 'Readiness analysis could not be completed.');
      }
    } finally {
      if (requestId === readinessRequestRef.current) setReadinessBusy(false);
    }
  }, [live.captureFrame]);
  useEffect(() => {
    if (mode !== 'live' || live.status !== 'on' || !poseAvailable) return;
    void analyzeReadiness();
    return () => { readinessRequestRef.current += 1; };
  }, [analyzeReadiness, live.facing, live.status, mode, poseAvailable]);
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

  return (
    <>
      <header className="coach-header">
        <button className="coach-back" onClick={onBack} aria-label="Back to AI Coach"><Icon name="arrow" size={24}/></button>
        <h2>Camera check</h2>
      </header>

      <div className="camera-tabs">
        <button className={mode==='live'?'active':''} onClick={()=>setMode('live')}>Live feed</button>
        <button className={mode==='upload'?'active':''} onClick={switchToUpload}>Upload video</button>
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
            {live.status === 'on' && <p className="camera-distance-pill" role="status"><i aria-hidden="true"/>{readinessBusy ? 'Checking camera readiness…' : liveReadiness?.distance.label ?? 'Distance not assessed'}</p>}
          </div>
          {live.message && <p className="camera-message" role="alert">{live.message}</p>}

          <section className="readiness-list" aria-labelledby="readiness-title">
            <div className="section-head">
              <h3 id="readiness-title">Readiness checks</h3>
              <small>{readinessBusy ? 'Analyzing live view…' : `${readyCheckCount(liveReadiness, live.status === 'on')} of 4 ready`}</small>
            </div>
            <ul className="readiness-rows">
              <ReadinessRow label="Camera feed" check={{ status: live.status === 'on' ? 'ready' : 'unknown', label: live.status === 'on' ? 'Connected' : live.status === 'starting' ? 'Starting' : 'Not connected' }} />
              <ReadinessRow label="Full body in frame" check={liveReadiness?.fullBody ?? { status: 'unknown', label: readinessBusy ? 'Analyzing…' : 'Not assessed' }} />
              <ReadinessRow label="Lighting" check={liveReadiness?.lighting ?? { status: 'unknown', label: readinessBusy ? 'Analyzing…' : 'Not assessed' }} />
              <ReadinessRow label="Distance" check={liveReadiness?.distance ?? { status: 'unknown', label: readinessBusy ? 'Analyzing…' : 'Not assessed' }} />
            </ul>
            {readinessError && <p className="camera-message" role="alert">{readinessError}</p>}
            {poseAvailable && live.status === 'on' && (
              <button type="button" className="readiness-retry" disabled={readinessBusy} onClick={() => void analyzeReadiness()}>
                {readinessBusy ? 'Analyzing camera…' : 'Analyze readiness again'}
              </button>
            )}
            <p className="camera-note">{cameraMessage}</p>
          </section>

          <footer className="coach-footer">
            <button className="primary" onClick={onStart}>Start session</button>
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

          <footer className="coach-footer">
            {fileUrl ? (
              <button className="primary" onClick={onStart}>Start manual session</button>
            ) : (
              <label className="primary choose-video">
                Choose a video
                <input type="file" accept="video/mp4,video/quicktime,video/*" onChange={e => chooseFile(e.target.files?.[0])}/>
              </label>
            )}
          </footer>
        </>
      )}
    </>
  );
}

function ReadinessRow({ label, check }: { label: string; check: ReadinessCheck }) {
  return (
    <li className={`readiness-row ${check.status}`}>
      <span><i aria-hidden="true">{check.status === 'ready' ? <Icon name="check" size={13} /> : null}</i>{label}</span>
      <b>{check.label}</b>
    </li>
  );
}
