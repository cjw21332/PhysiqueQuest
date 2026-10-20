'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../sections/Home/icons';
import { deviceOsStatus } from '../../lib/deviceReadiness.mjs';

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

  const osStatus = deviceOsStatus(readiness.platform, readiness.osVersion);
  const readyCount = useMemo(() => [deviceOsStatus(readiness.platform, readiness.osVersion).ready, readiness.wifiConnected, readiness.cameraPermission === 'granted'].filter(Boolean).length, [readiness]);

  const requestCameraPermission = async () => {
    setCameraRequesting(true);
    try {
      if (isNativeBridgeAvailable()) {
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'request-camera-permission' }));
        setNotice('Camera access requested for photos and previews. You can continue without it.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setReadiness(current => ({ ...current, cameraPermission: 'unavailable' }));
        setNotice('Camera access is unavailable here. You can continue without it or try a secure browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach(track => track.stop());
      setReadiness(current => ({ ...current, cameraPermission: 'granted' }));
      setNotice('Camera permission granted.');
    } catch {
      setReadiness(current => ({ ...current, cameraPermission: 'denied' }));
      setNotice('Camera access was not granted. You can continue without it or enable it in browser settings.');
    } finally {
      setCameraRequesting(false);
    }
  };

  const cameraLabel = readiness.cameraPermission === 'granted' ? 'Granted · photos and previews' : readiness.cameraPermission === 'denied' ? 'Blocked · you can continue' : readiness.cameraPermission === 'unavailable' ? 'Unavailable · you can continue' : 'Optional · photos and previews';
  const networkLabel = readiness.wifiConnected ? `Connected${readiness.wifiSpeedMbps == null ? '' : ` · ${isNativeBridgeAvailable() ? '' : 'Estimated · '}${readiness.wifiSpeedMbps} Mbps`}` : readiness.networkType === 'unknown' ? 'Connection details unavailable' : `${readiness.networkType} · Wi-Fi not confirmed`;
  const deviceLabel = readiness.osVersion ? `${readiness.osName ?? readiness.platform} ${readiness.osVersion} detected` : `${readiness.osName ?? readiness.platform} version unavailable`;

  return (
    <main className="scene">
      <div className="app-shell">
        <section className="launch screen-enter">
          <div className="launch-brand"><span className="launch-logo"><img src="/logo.jpg" alt="PhysiqueQuest logo" className="brand-logo" /></span><h1>PhysiqueQuest</h1><p className="subtitle">Workout plans, exercise guides, food logs and quests.</p></div>
          <div className="launch-spacer" />
          <div className="readiness">
            <div className="readiness-head"><b>Device checks</b><span>{readyCount} of 3 confirmed</span></div>
            <ReadinessRow ready={osStatus.ready} title={osStatus.title} detail={deviceLabel} />
            <ReadinessRow ready={readiness.wifiConnected} title="Network connection" detail={networkLabel} />
            <div className="ready-row">
              <b className={readiness.cameraPermission === 'granted' ? 'ready-icon' : 'camera-icon'}>{readiness.cameraPermission === 'granted' ? <Icon name="check" size={17}/> : <Icon name="camera" size={16}/>}</b>
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
  return <div className="ready-row"><b className={ready ? 'ready-icon' : 'camera-icon'}>{ready ? <Icon name="check" size={17}/> : '!'}</b><p>{title}<small>{detail}</small></p></div>;
}
