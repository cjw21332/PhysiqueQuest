'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Home/icons';
import { api, ApiRequestError } from '../../lib/api';
import OutcomeDialog from '../../components/OutcomeDialog';
import './video-review.css';

export default function CameraCheck({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<unknown>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const recordingRef = useRef<HTMLVideoElement>(null);
  const analysisGeneration = useRef(0);
  const [cameraMessage, setCameraMessage] = useState('');
  const [poseAvailable, setPoseAvailable] = useState<boolean | null>(null);
  const [statusCheck, setStatusCheck] = useState(0);
  useEffect(() => { return () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }; }, [fileUrl]);
  useEffect(() => () => { analysisGeneration.current++; }, []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      setPoseAvailable(null);
      setCameraMessage('Checking video analysis availability…');
      let available = false;
      try { available = (await api.getPoseStatus()).available === true; } catch { /* The next check can recover after a temporary outage. */ }
      if (!active) return;
      setPoseAvailable(available);
      setCameraMessage(available ? 'Your video is sent for analysis. Selected frames may also be sent to an AI service.' : 'Video analysis is temporarily unavailable. We’ll keep checking, or you can try again.');
      if (!available) timer = setTimeout(check, 10000);
    };
    void check();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [statusCheck]);
  const retryAvailability = useCallback(() => setStatusCheck(value => value + 1), []);
  const chooseFile = (file?: File) => { if (!file) return; analysisGeneration.current++; setFileUrl(URL.createObjectURL(file)); setFileName(file.name); setSelectedFile(file); setDuration(null); setPreviewError(false); setAnalysisBusy(false); setAnalysis(null); setAnalysisError(''); };
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
      const result = await api.analyzePose({ mediaBase64, mimeType, analysisType: 'workout', durationSeconds: Math.ceil(duration) });
      if (analysisGeneration.current === generation) { recordingRef.current?.pause(); setAnalysis(result); setReportOpen(true); }
    } catch (error) { if (analysisGeneration.current === generation) setAnalysisError(error instanceof ApiRequestError && error.statusCode >= 500 ? 'Video analysis is temporarily unavailable. Please try this recording again shortly.' : error instanceof Error ? error.message : 'Video analysis could not be completed. Please try again.'); }
    finally { if (analysisGeneration.current === generation) setAnalysisBusy(false); }
  };
  const continueWithoutCamera = () => onStart();

  return (
    <>
      <div className="video-review-view" hidden={reportOpen && Boolean(analysis)}>
      <header className="coach-header pq-page-heading">
        <button type="button" className="coach-back" onClick={onBack} aria-label="Back to AI Coach"><Icon name="arrow" size={24}/></button>
        <h2>Review a video</h2>
      </header>

          <section className="video-review" aria-label="Review recording">
            <input ref={videoInputRef} hidden type="file" aria-label="Choose a recorded exercise video" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={e => { chooseFile(e.target.files?.[0]); e.target.value = ''; }}/>
            {fileUrl ? (
              <>
                <div className="video-review-frame"><video ref={recordingRef} src={fileUrl} controls playsInline aria-label="Selected exercise recording" onLoadedMetadata={event => { setDuration(event.currentTarget.videoWidth > 0 ? event.currentTarget.duration : null); setPreviewError(false); }} onError={() => setPreviewError(true)}/></div>
                <div className="video-review-file"><span className="video-review-file-icon" aria-hidden="true"><Icon name="play" size={18}/></span><div><span>YOUR RECORDING</span><strong>{fileName}</strong><small>{duration && Number.isFinite(duration) ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')} · ` : ''}{previewError ? 'Preview unavailable on this device' : 'Preview ready'}</small></div></div>
                <div className="video-review-actions">
                  {poseAvailable === true && <button type="button" className="primary" disabled={analysisBusy} onClick={() => void analyzeVideo()}>{analysisBusy ? 'Analyzing video…' : 'Analyze video'}</button>}
                  {Boolean(analysis) && <button type="button" className="secondary" onClick={() => { recordingRef.current?.pause(); setReportOpen(true); }}>View recording report</button>}
                  <button type="button" className="secondary" disabled={analysisBusy} onClick={() => videoInputRef.current?.click()}>Choose a different video</button>
                </div>
                {analysisBusy && <p className="video-review-status" role="status">Analyzing your recording…</p>}
              </>
            ) : (
              <div className="video-review-empty"><span className="video-review-upload-icon" aria-hidden="true"><Icon name="upload" size={26}/></span><h3>Review your movement</h3><p>Choose a recording to preview and analyze your set.</p><button type="button" className="primary" onClick={() => videoInputRef.current?.click()}>Choose a video</button><small>MP4 or MOV · up to 2 minutes · 20 MB max</small></div>
            )}
            <aside className="video-review-guidance"><span aria-hidden="true"><Icon name="camera" size={18}/></span><div><strong>For a clearer review</strong><p>Film in good light and keep the movement in frame.</p></div></aside>
            <p className="video-review-privacy" role="status">{cameraMessage}</p>
            {poseAvailable === false && <button type="button" className="secondary video-review-retry" onClick={retryAvailability}>Try again</button>}
            {fileUrl && <button type="button" className="video-review-manual" disabled={analysisBusy} onClick={continueWithoutCamera}>Continue with a manual session</button>}
          </section>
      {analysisError && !reportOpen && <OutcomeDialog kind="error" title="Video analysis unavailable" message={analysisError} actionLabel="Choose another video" onAction={() => { setAnalysisError(''); videoInputRef.current?.click(); }} secondaryLabel="Go back" onSecondary={() => setAnalysisError('')} onClose={() => setAnalysisError('')}/>}
      </div>
      {reportOpen && Boolean(analysis) && <AnalysisReport value={analysis} fileName={fileName} onBack={() => setReportOpen(false)} onStart={continueWithoutCamera} onRetry={() => void analyzeVideo()} retrying={analysisBusy} retryError={analysisError}/>}
    </>
  );
}

function AnalysisReport({ value, fileName, onBack, onStart, onRetry, retrying, retryError }: { value: unknown; fileName: string; onBack: () => void; onStart: () => void; onRetry: () => void; retrying: boolean; retryError: string }) {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const metrics = data.metrics && typeof data.metrics === 'object' ? data.metrics as Record<string, unknown> : {};
  const observations = Array.isArray(data.observations) ? data.observations.filter((item): item is string => typeof item === 'string') : [];
  const review = data.exerciseReview && typeof data.exerciseReview === 'object' ? data.exerciseReview as Record<string, unknown> : null;
  const movement = data.movementEstimate && typeof data.movementEstimate === 'object' ? data.movementEstimate as Record<string, unknown> : null;
  const field = (name: string) => typeof review?.[name] === 'string' ? String(review[name]) : 'Unknown';
  const items = (name: string) => Array.isArray(review?.[name]) ? (review[name] as unknown[]).filter((item): item is string => typeof item === 'string') : [];
  const seconds = typeof metrics.durationSeconds === 'number' && Number.isFinite(metrics.durationSeconds) && metrics.durationSeconds > 0 ? Math.round(metrics.durationSeconds) : null;
  const duration = seconds === null ? 'Unavailable' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const reps = typeof movement?.estimatedReps === 'number' ? movement.estimatedReps : typeof review?.estimatedReps === 'number' ? review.estimatedReps : null;
  return <section className="recording-report video-report-v2" aria-label="Video analysis">
    <header className="coach-header pq-page-heading"><button type="button" className="coach-back" onClick={onBack} aria-label="Back to video"><Icon name="arrow" size={20}/></button><h2>Recording report</h2></header>
    <div className="recording-report-body">
      <div className="video-report-hero"><p className="report-eyebrow">Your movement review</p><h1>{review && field('exercise') !== 'Unknown' ? field('exercise') : 'Exercise not identified'}</h1><p className="report-filename">{fileName}</p><p className="report-muted">Exercise identification is an estimate. Check it against your video.</p></div>
      <div className="video-report-stats"><div><span>Estimated reps</span><strong>{reps === null ? 'Not clear' : reps}</strong></div><div><span>Duration</span><strong>{duration}</strong></div></div>
      {review && [['formObservations', 'What we noticed'], ['corrections', 'Things to consider']].map(([key, title]) => items(key).length > 0 && <section className="video-report-section" key={key}><h3>{title}</h3><ul>{items(key).map((item, index) => <li key={index}>{item}</li>)}</ul></section>)}
      {!review && observations.length > 0 && <section className="video-report-section"><h3>Analysis notes</h3><ul>{observations.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
      {review && <details className="video-report-details"><summary>Exercise details</summary><dl className="recording-details"><div><dt>Equipment</dt><dd>{field('equipment')}</dd></div><div><dt>Body area</dt><dd>{field('generalBodyPart')}</dd></div><div><dt>Muscles</dt><dd>{field('specificMuscles')}</dd></div></dl></details>}
      {!review && <div className="report-card"><h3>Exercise review unavailable</h3><p>We couldn’t complete the exercise review. Please try again.</p><button type="button" className="secondary" disabled={retrying} onClick={onRetry}>{retrying ? 'Retrying analysis…' : 'Retry exercise review'}</button>{retryError && <p role="alert">{retryError}</p>}</div>}
      <p className="video-report-disclaimer">Feedback is an estimate, not a form or safety assessment. Review your recording with a qualified coach. Your workout has not been changed.</p>
      <button type="button" className="primary report-action" onClick={onStart}>Start manual session</button><button type="button" className="quiet-link report-back" onClick={onBack}>Back to video</button>
    </div>
  </section>;
}

