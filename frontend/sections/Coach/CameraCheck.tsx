'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Home/icons';
import { api } from '../../lib/api';
import { useCameraStream } from '../../hooks/useCameraStream';

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
  const live = useCameraStream();
  useEffect(() => { return () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }; }, [fileUrl]);
  useEffect(() => { let active = true; api.getPoseStatus().then(status => { if (!active) return; setPoseAvailable(status.available); setCameraMessage(status.available ? 'Pose analysis is available after a video is submitted.' : 'Pose analysis provider is not configured on the backend.'); }).catch(error => { if (active) setCameraMessage(error instanceof Error ? error.message : 'Could not check pose-analysis availability.'); }); return () => { active = false; }; }, []);
  const chooseFile = (file?: File) => { if (!file) return; if (fileUrl) URL.revokeObjectURL(fileUrl); setFileUrl(URL.createObjectURL(file)); setFileName(file.name); setSelectedFile(file); setAnalysis(null); setAnalysisError(''); };
  const analyzeVideo = async () => {
    if (!selectedFile) return;
    if (selectedFile.size > 20 * 1024 * 1024) { setAnalysisError('Choose a video smaller than 20 MB.'); return; }
    if (!['video/mp4', 'video/quicktime'].includes(selectedFile.type)) { setAnalysisError('Choose an MP4 or MOV video.'); return; }
    setAnalysisBusy(true); setAnalysisError('');
    try {
      const mediaBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Could not read selected video.')); reader.onload = () => resolve(String(reader.result).split(',')[1] ?? ''); reader.readAsDataURL(selectedFile); });
      const result = await api.analyzePose({ mediaBase64, mimeType: selectedFile.type });
      setAnalysis(result);
    } catch (error) { setAnalysisError(error instanceof Error ? error.message : 'Pose analysis did not complete.'); }
    finally { setAnalysisBusy(false); }
  };
  const switchToUpload = () => { live.stop(); setMode('upload'); };

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
          <div className={`camera-preview ${live.status === 'on' ? 'camera-on' : ''}`}>
            <video ref={live.videoRef} autoPlay muted playsInline/>
            {live.status !== 'on' && (
              <div className="camera-off">
                <button type="button" className="camera-enable" disabled={live.status === 'starting'} onClick={() => void live.start()}>
                  {live.status === 'starting' ? 'Starting camera...' : 'Enable camera'}
                </button>
              </div>
            )}
            <div className="camera-frame" aria-hidden="true">
              <span/><span/><span/><span/>
            </div>
            {live.status === 'on' && (
              <p className="camera-distance-pill" role="status"><i aria-hidden="true"/>Distance not measured</p>
            )}
          </div>
          {live.message && <p className="camera-message" role="alert">{live.message}</p>}

          <section className="readiness-list" aria-labelledby="readiness-title">
            <div className="section-head">
              <h3 id="readiness-title">Readiness checks</h3>
              <small>{poseAvailable ? 'Pose analysis on' : 'Unavailable'}</small>
            </div>
            <ul className="readiness-rows">
              <li className="readiness-row"><span>Full body in frame</span><b>{poseAvailable ? 'Waiting for video' : 'Unavailable'}</b></li>
              <li className="readiness-row"><span>Lighting</span><b>{live.status === 'on' ? 'Camera on' : 'Camera off'}</b></li>
              <li className="readiness-row"><span>Distance</span><b>{poseAvailable ? 'Waiting for video' : 'Unavailable'}</b></li>
            </ul>
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
                  <Icon name="trend" size={24}/>
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

