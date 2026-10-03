'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Home/icons';

export default function CameraCheck({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const [mode, setMode] = useState<'live' | 'upload'>('live');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [cameraMessage, setCameraMessage] = useState('Camera preview is a demo until camera tracking is connected.');
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => { return () => { if (fileUrl) URL.revokeObjectURL(fileUrl); streamRef.current?.getTracks().forEach(track => track.stop()); }; }, [fileUrl]);
  const chooseFile = (file?: File) => { if (!file) return; if (fileUrl) URL.revokeObjectURL(fileUrl); setFileUrl(URL.createObjectURL(file)); setFileName(file.name); };
  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraMessage('Camera ready · keep your full body in frame.');
    } catch { setCameraMessage('Camera access was not available. You can continue with the demo preview or upload a video.'); }
  };
  const switchToUpload = () => { streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; setCameraOn(false); setMode('upload'); };

  return (
    <>
      <header className="coach-header">
        <h2>Camera check</h2>
      </header>

      <div className="camera-tabs">
        <button className={mode==='live'?'active':''} onClick={()=>setMode('live')}>Live feed</button>
        <button className={mode==='upload'?'active':''} onClick={switchToUpload}>Upload video</button>
      </div>

      {mode === 'live' ? (
        <>
          <div className={`camera-preview ${cameraOn?'camera-on':''}`}>
            <video ref={videoRef} autoPlay muted playsInline/>
            <div className="camera-frame">
              <span/><span/><span/><span/>
            </div>
            {!cameraOn && (
              <div className="camera-person">
                <i className="person-head"/>
                <i className="person-body"/>
                <i className="person-arm left"/>
                <i className="person-arm right"/>
                <i className="person-leg left"/>
                <i className="person-leg right"/>
              </div>
            )}
            <span className="distance-pill">
              <i/> Distance 2.7 m · in range
            </span>
          </div>

          <div className="readiness-list">
            <div className="section-head">
              <h3>Readiness checks</h3>
              <small>4 of 4</small>
            </div>
            <Check label="Full body in frame" value="Detected"/>
            <Check label="Lighting" value="Sufficient"/>
          </div>

          <footer className="coach-footer">
            <button className="primary" onClick={onStart}>Start session</button>
          </footer>
        </>
      ) : (
        <>
          <div className="upload-panel">
            {fileUrl ? (
              <>
                <video src={fileUrl} controls/>
                <b>{fileName}</b>
                <small>Video stays on this device in this prototype.</small>
                <button className="quiet-link" onClick={() => { URL.revokeObjectURL(fileUrl); setFileUrl(''); setFileName(''); }}>
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
                <label className="choose-video">
                  Choose a video
                  <input type="file" accept="video/mp4,video/quicktime,video/*" onChange={e => chooseFile(e.target.files?.[0])}/>
                </label>
              </>
            )}
          </div>

          <footer className="coach-footer">
            <button className="primary" disabled={!fileUrl} onClick={onStart}>
              {!fileUrl ? 'Choose a video to continue' : 'Start session'}
            </button>
          </footer>
        </>
      )}
    </>
  );
}

function Check({ label, value }: { label: string; value: string }) { return <div className="readiness-check"><span><i><Icon name="check" size={11}/></i>{label}</span><small>{value}</small></div>; }
