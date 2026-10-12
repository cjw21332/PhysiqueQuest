'use client';

import { useEffect, useMemo, useState } from 'react';

type CameraPermission = 'granted' | 'denied' | 'prompt' | 'unavailable';
type DeviceReadiness = {
  platform: string;
  osName: string | null;
  osVersion: string | null;
  networkType: string;
  wifiConnected: boolean;
  wifiSpeedMbps: number | null;
  cameraPermission: CameraPermission;
};

type NetworkInformation = { type?: string; effectiveType?: string; downlink?: number };

declare global {
  interface Navigator { connection?: NetworkInformation; }
  interface Window { ReactNativeWebView?: { postMessage: (message: string) => void }; }
}

const emptyReadiness: DeviceReadiness = {
  platform: 'browser',
  osName: null,
  osVersion: null,
  networkType: 'unknown',
  wifiConnected: false,
  wifiSpeedMbps: null,
  cameraPermission: 'prompt',
};

function browserReadiness(): DeviceReadiness {
  const userAgent = navigator.userAgent;
  const android = userAgent.match(/Android\s([\d.]+)/i);
  const connection = navigator.connection;
  const networkType = connection?.type ?? connection?.effectiveType ?? 'unknown';
  return {
    platform: /Android/i.test(userAgent) ? 'android' : /iPhone|iPad|iPod/i.test(userAgent) ? 'ios' : 'browser',
    osName: /Android/i.test(userAgent) ? 'Android' : /iPhone|iPad|iPod/i.test(userAgent) ? 'iOS' : 'Browser',
    osVersion: android?.[1] ?? null,
    networkType,
    wifiConnected: connection?.type === 'wifi',
    wifiSpeedMbps: typeof connection?.downlink === 'number' ? connection.downlink : null,
    cameraPermission: 'prompt',
  };
}

function isNativeBridgeAvailable() { return typeof window !== 'undefined' && Boolean(window.ReactNativeWebView); }

export default function LaunchPage() {
  const [readiness, setReadiness] = useState<DeviceReadiness>(emptyReadiness);
  const [notice, setNotice] = useState('');
  const [cameraRequesting, setCameraRequesting] = useState(false);

  useEffect(() => {
    setReadiness(browserReadiness());
    const onReadiness = (event: Event) => {
      const detail = (event as CustomEvent<DeviceReadiness>).detail;
      if (detail) setReadiness(detail);
    };
    window.addEventListener('physiquequest-device-readiness', onReadiness);
    if (isNativeBridgeAvailable()) window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'request-device-readiness' }));
    return () => window.removeEventListener('physiquequest-device-readiness', onReadiness);
  }, []);

  const readyCount = useMemo(() => [Boolean(readiness.osVersion), readiness.wifiConnected, readiness.cameraPermission === 'granted'].filter(Boolean).length, [readiness]);

  const requestCameraPermission = async () => {
    setCameraRequesting(true);
    try {
      if (isNativeBridgeAvailable()) {
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'request-camera-permission' }));
        setNotice('Phone camera permission request sent. Approve it to enable camera features.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setReadiness(current => ({ ...current, cameraPermission: 'unavailable' }));
        setNotice('This browser does not expose camera access. Open the app in a supported secure browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach(track => track.stop());
      setReadiness(current => ({ ...current, cameraPermission: 'granted' }));
      setNotice('Camera permission granted.');
    } catch {
      setReadiness(current => ({ ...current, cameraPermission: 'denied' }));
      setNotice('Camera permission was not granted. You can enable it in browser settings.');
    } finally {
      setCameraRequesting(false);
    }
  };

  const cameraLabel = readiness.cameraPermission === 'granted' ? 'Granted' : readiness.cameraPermission === 'denied' ? 'Blocked' : readiness.cameraPermission === 'unavailable' ? 'Unavailable' : 'Needed for form tracking';
  const networkLabel = readiness.wifiConnected ? `Connected${readiness.wifiSpeedMbps == null ? '' : ` · ${isNativeBridgeAvailable() ? '' : 'Estimated · '}${readiness.wifiSpeedMbps} Mbps`}` : readiness.networkType === 'unknown' ? 'Connection speed unavailable' : `${readiness.networkType} · Wi-Fi not detected`;
  const deviceLabel = readiness.osVersion ? `${readiness.osName ?? readiness.platform} ${readiness.osVersion} detected` : `${readiness.osName ?? readiness.platform} version unavailable`;

  return (
    <main className="scene">
      <div className="app-shell">
        <section className="launch screen-enter">
          <div className="launch-brand"><img src="/physiquequest-icon.png" alt="PhysiqueQuest logo" className="brand-logo" /><h1>PhysiqueQuest</h1><p className="subtitle">AI-assisted, gamified fitness coaching that watches your form.</p></div>
          <div className="launch-spacer" />
          <div className="readiness">
            <div className="readiness-head"><b>Device readiness</b><span>{readyCount} of 3 ready</span></div>
            <ReadinessRow ready={Boolean(readiness.osVersion)} title="Device OS version" detail={deviceLabel} />
            <ReadinessRow ready={readiness.wifiConnected} title="Wi-Fi connection" detail={networkLabel} />
            <div className="ready-row">
              <b className={readiness.cameraPermission === 'granted' ? 'ready-icon' : 'camera-icon'}>{readiness.cameraPermission === 'granted' ? '✓' : '◎'}</b>
              <p>Camera permission<small>{cameraLabel}</small></p>
              {readiness.cameraPermission !== 'granted' && <button className="allow" disabled={cameraRequesting} onClick={requestCameraPermission}>{cameraRequesting ? 'Waiting…' : 'Allow'}</button>}
            </div>
          </div>
          <div className="launch-actions"><a className="primary" href="/register">Get started</a><a className="secondary" href="/login">I already have an account</a></div>
        </section>
        {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
      </div>
    </main>
  );
}

function ReadinessRow({ ready, title, detail }: { ready: boolean; title: string; detail: string }) {
  return <div className="ready-row"><b className={ready ? 'ready-icon' : 'camera-icon'}>{ready ? '✓' : '!'}</b><p>{title}<small>{detail}</small></p></div>;
}
