import Constants from 'expo-constants';
import { Camera, CameraView } from 'expo-camera';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { isTrustedWebViewUrl, resolveApiUrl, resolveFrontendUrl } from './connection.mjs';
import { createNativeMonitor } from './inactivity/nativeMonitor';
import NativeTrackingCamera, { nativePoseAvailable, poseScript, type NativeTrackingOptions } from './NativeTrackingCamera';
import { readinessMessageLimit, readinessScript, validateNativeReadinessContext, validateReadinessCheck, type NativeReadinessContext, type ReadinessCheck } from '../shared/cameraReadiness';

declare const process: { env: { EXPO_PUBLIC_WEB_APP_URL?: string; EXPO_PUBLIC_API_URL?: string } };

type DeviceReadiness = {
  platform: string;
  osName: string | null;
  osVersion: string | null;
  networkType: string;
  wifiConnected: boolean;
  wifiSpeedMbps: number | null;
  cameraPermission: string;
};

type CameraFrame = { x: number; y: number; width: number; height: number };
type NativeCameraContext =
  | { screen: 'camera-check'; readiness: NativeReadinessContext }
  | { screen: 'live-session'; exerciseName: string; equipment: string; elapsed: string; tracking?: NativeTrackingOptions };
type NativeCameraPreview = { frame: CameraFrame; facing: 'back' | 'front'; context: NativeCameraContext; instanceId: number };

export function isNativeCameraContext(value: unknown): value is NativeCameraContext {
  if (!value || typeof value !== 'object' || !('screen' in value)) return false;
  const context = value as Record<string, unknown>;
  if (context.screen === 'camera-check') return validateNativeReadinessContext(context.readiness);
  if (context.tracking !== undefined) {
    const tracking = context.tracking as Partial<NativeTrackingOptions> | null;
    if (!tracking || typeof tracking !== 'object' || typeof tracking.requestId !== 'string' || !tracking.requestId.length || tracking.requestId.length > 100 ||
      !['squat', 'curl'].includes(tracking.kind ?? '') || !['left', 'right'].includes(tracking.side ?? '') || typeof tracking.active !== 'boolean') return false;
  }
  return context.screen === 'live-session'
    && typeof context.exerciseName === 'string'
    && typeof context.equipment === 'string'
    && typeof context.elapsed === 'string'
    && context.exerciseName.length <= 100
    && context.equipment.length <= 60
    && context.elapsed.length <= 8;
}

export function isCameraFrame(frame: unknown): frame is CameraFrame {
  if(!frame || typeof frame!=='object')return false;
  const f=frame as CameraFrame;
  return [f.x,f.y,f.width,f.height].every(n=>Number.isFinite(n) && Math.abs(n)<=32768) && f.width>0 && f.height>0;
}
export function nativeFramingText(check:ReadinessCheck) {
  if(!validateReadinessCheck(check))return 'Framing unavailable';
  if(check.status==='ready')return 'Framing ready';
  return ({'too-small':'Move a little closer','too-large':'Move a little farther away','clipped':'Keep your whole body in view',pending:'Checking framing…',uncalibrated:'Framing validation pending',bent:'Stand upright to check framing'} as Partial<Record<ReadinessCheck['reason'],string>>)[check.reason]??'Framing unavailable';
}

function getInitialAddress() {
  const extra = Constants.expoConfig?.extra as { EXPO_PUBLIC_WEB_APP_URL?: string } | undefined;
  return resolveFrontendUrl(process.env.EXPO_PUBLIC_WEB_APP_URL ?? extra?.EXPO_PUBLIC_WEB_APP_URL, Constants.expoConfig?.hostUri);
}

/**
 * Publishes the native safe-area insets (status bar, Android gesture/nav bar,
 * display cutouts) to the web document as CSS custom properties so the web app
 * can pad its content clear of the system UI.
 */
function buildInsetsScript(insets: { top: number; bottom: number; left: number; right: number }, apiUrl: string, fontScale: number) {
  const { top, bottom, left, right } = insets;
  const encodedApiUrl = JSON.stringify(apiUrl);
  return `(function(){try{
    var r=document.documentElement.style;
    document.documentElement.dataset.largeText='${fontScale >= 1.5}';
    r.setProperty('--safe-top','${top}px');
    r.setProperty('--safe-bottom','${bottom}px');
    r.setProperty('--safe-left','${left}px');
    r.setProperty('--safe-right','${right}px');
    r.setProperty('-webkit-text-size-adjust','${Platform.OS === 'ios' ? Math.round(fontScale * 100) : 100}%');
    r.setProperty('text-size-adjust','${Platform.OS === 'ios' ? Math.round(fontScale * 100) : 100}%');
    var m=document.createElement('meta');
    m.name='viewport';
    m.content='width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover';
    document.head.appendChild(m);
    localStorage.setItem('physiquequest-runtime-api-url',${encodedApiUrl});
    localStorage.setItem('physiquequest-app-version',${JSON.stringify(Constants.expoConfig?.version ?? '')});
  }catch(e){}})();true;`;
}

function buildBackendCheckScript(apiUrl: string) {
  return `(function(){fetch(${JSON.stringify(apiUrl)},{credentials:'include'}).then(function(r){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'backend-status',ok:r.ok,status:r.status}));}).catch(function(){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'backend-status',ok:false}));});})();true;`;
}

/** Delivers a host event to the WebView as the `physiquequest-inactivity` CustomEvent. */
function buildInactivityScript(detail: Record<string, unknown>) {
  const payload = JSON.stringify(detail).replace(/</g, '\\u003c');
  return `(function(){window.dispatchEvent(new CustomEvent('physiquequest-inactivity',{detail:${payload}}));})();true;`;
}

function buildReadinessScript(readiness: DeviceReadiness) {
  const payload = JSON.stringify(readiness).replace(/</g, '\\u003c');
  return `(function(){window.dispatchEvent(new CustomEvent('physiquequest-device-readiness',{detail:${payload}}));})();true;`;
}

function buildCameraScript(detail: {
  type: string;
  status?: string;
  message?: string;
  requestId?: string;
  mediaBase64?: string;
  facing?: 'back' | 'front';
}) {
  const payload = JSON.stringify(detail).replace(/</g, '\\u003c');
  return `(function(){window.dispatchEvent(new CustomEvent('physiquequest-camera',{detail:${payload}}));})();true;`;
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const { width, fontScale } = useWindowDimensions();
  const inferredAddress = useMemo(getInitialAddress, []);
  const extra = Constants.expoConfig?.extra as { EXPO_PUBLIC_API_URL?: string } | undefined;
  const [address, setAddress] = useState(inferredAddress ?? '');
  const [loadedAddress, setLoadedAddress] = useState(inferredAddress);
  const apiUrl = useMemo(() => loadedAddress ? resolveApiUrl(process.env.EXPO_PUBLIC_API_URL ?? extra?.EXPO_PUBLIC_API_URL, loadedAddress) : null, [extra?.EXPO_PUBLIC_API_URL, loadedAddress]);
  const [error, setError] = useState(!inferredAddress);
  const [key, setKey] = useState(0);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [readiness, setReadiness] = useState<DeviceReadiness | null>(null);
  const [cameraPreview, setCameraPreview] = useState<NativeCameraPreview | null>(null);
  const [framing,setFraming]=useState<ReadinessCheck>({status:'unknown',reason:'pending'});
  const cameraRequestId = useRef(0);
  const monitor = useRef<ReturnType<typeof createNativeMonitor> | null>(null);
  if (!monitor.current) {
    monitor.current = createNativeMonitor({
      onEvent: detail => {
        if (detail.type === 'countdown-started' || detail.type === 'alarm-started' || detail.type === 'alarm' || detail.type === 'stopped') {
          cameraRequestId.current += 1;
          setCameraPreview(null);
        }
        webRef.current?.injectJavaScript(buildInactivityScript(detail));
      },
    });
  }

  useEffect(() => () => monitor.current?.stop(), []);

  const insetScript = useMemo(
    () => buildInsetsScript({ top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right }, apiUrl ?? 'invalid-api-address', fontScale),
    [apiUrl, insets.top, insets.bottom, insets.left, insets.right, fontScale],
  );

  const pushInsets = useCallback(() => {
    webRef.current?.injectJavaScript(insetScript);
  }, [insetScript]);
  useEffect(() => { pushInsets(); }, [pushInsets]);

  const checkBackend = useCallback(() => {
    setBackendStatus('checking');
    if (apiUrl) webRef.current?.injectJavaScript(buildBackendCheckScript(apiUrl));
    else setBackendStatus('offline');
  }, [apiUrl]);

  const collectReadiness = useCallback(async () => {
    const network = await Network.getNetworkStateAsync();
    let wifiSpeedMbps: number | null = null;
    try {
      const netInfo = await NetInfo.fetch();
      const details = netInfo.details as { linkSpeed?: number | null } | null;
      wifiSpeedMbps = typeof details?.linkSpeed === 'number' ? details.linkSpeed : null;
    } catch (error) {
      console.warn('Wi-Fi link speed is unavailable in this Expo runtime:', error);
    }
    let cameraPermission = 'unavailable';
    try {
      const camera = await Camera.getCameraPermissionsAsync();
      cameraPermission = camera.status;
    } catch (error) {
      console.warn('Camera permission status is unavailable in this Expo runtime:', error);
    }
    const next: DeviceReadiness = {
      platform: Platform.OS,
      osName: Device.osName ?? Platform.OS,
      osVersion: Device.osVersion ?? (Platform.OS === 'android' ? String(Platform.Version) : null),
      networkType: network.type ?? 'unknown',
      wifiConnected: network.type === Network.NetworkStateType.WIFI && network.isConnected === true,
      wifiSpeedMbps,
      cameraPermission,
    };
    setReadiness(next);
    return next;
  }, []);

  const publishReadiness = useCallback(async () => {
    const next = await collectReadiness();
    webRef.current?.injectJavaScript(buildReadinessScript(next));
  }, [collectReadiness]);

  const requestCameraPermission = useCallback(async () => {
    let granted = false;
    try {
      const permission = await Camera.requestCameraPermissionsAsync();
      granted = permission.granted;
    } catch (error) {
      console.warn('Camera permission request failed:', error);
    }
    await publishReadiness();
    return granted;
  }, [publishReadiness]);

  const startNativeCamera = useCallback(async (
    frame: CameraFrame,
    facing: 'back' | 'front',
    context: NativeCameraContext,
    requestId: number,
  ) => {
    const validFrame = isCameraFrame(frame) && (context.screen!=='camera-check' ||
      (context.readiness.previewWidth===frame.width && context.readiness.previewHeight===frame.height));
    if (!validFrame) {
      webRef.current?.injectJavaScript(buildCameraScript({
        type: 'status',
        status: 'unavailable',
        message: 'The camera preview could not be positioned. Try opening the camera again.',
      }));
      return;
    }

    try {
      const permission = await Camera.getCameraPermissionsAsync();
      const granted = permission.granted || await requestCameraPermission();
      if (requestId !== cameraRequestId.current) return;
      if (!granted) {
        webRef.current?.injectJavaScript(buildCameraScript({
          type: 'status',
          status: 'denied',
          message: 'Camera access is blocked. Allow camera access in your phone settings, then try again.',
        }));
        return;
      }
      setFraming({status:'unknown',reason:'pending'});
      setCameraPreview({ frame, facing, context, instanceId:requestId });
      webRef.current?.injectJavaScript(buildCameraScript({ type: 'status', status: 'starting' }));
    } catch (error) {
      console.error('Native camera could not start:', error);
      if (requestId !== cameraRequestId.current) return;
      webRef.current?.injectJavaScript(buildCameraScript({
        type: 'status',
        status: 'unavailable',
        message: 'The camera could not start. Close other apps using the camera and try again.',
      }));
    }
  }, [requestCameraPermission]);

  const updateNativeCameraFrame = useCallback((frame: CameraFrame, context?: NativeCameraContext) => {
    if (!isCameraFrame(frame)) return;
    setCameraPreview(current => current ? { ...current, frame, ...(context ? { context } : {}) } : current);
  }, []);

  const updateNativeCameraContext = useCallback((context: NativeCameraContext) => {
    setCameraPreview(current => current ? { ...current, context } : current);
  }, []);

  const stopNativeCamera = useCallback(() => {
    cameraRequestId.current += 1;
    setCameraPreview(null);
    webRef.current?.injectJavaScript(buildCameraScript({ type: 'status', status: 'idle' }));
  }, []);

  useEffect(()=>{
    const change=AppState.addEventListener('change',state=>{if(state!=='active')stopNativeCamera();});
    const blur=AppState.addEventListener('blur',stopNativeCamera);
    return ()=>{cameraRequestId.current++;change.remove();blur.remove();};
  },[stopNativeCamera]);

  const switchNativeCameraFacing = () => {
    const nextFacing = cameraPreview?.facing === 'back' ? 'front' : 'back';
    setCameraPreview(current => current ? { ...current, facing: nextFacing } : current);
    setFraming({status:'unknown',reason:'pending'});
    webRef.current?.injectJavaScript(buildCameraScript({ type: 'facing', facing: nextFacing }));
  };

  const connect = () => {
    const normalized = address.trim().replace(/\/$/, '');
    if (!normalized) {
      setError(true);
      return;
    }
    const withProtocol = /^https?:\/\//i.test(normalized) ? normalized : `http://${normalized}`;
    setAddress(withProtocol);
    setLoadedAddress(withProtocol);
    setError(false);
    setBackendStatus('checking');
    setKey(c => c + 1);
    Keyboard.dismiss();
  };

  const pad = Math.max(16, Math.min(40, Math.round(width * 0.05)));
  const cardMax = Math.min(width - pad * 2, 560);
  const cardPad = Math.max(22, Math.min(38, Math.round(width * 0.07)));
  const bodySize = Math.max(15, Math.min(18, Math.round(width / 24)));
  const poseOptions=cameraPreview?.context.screen==='camera-check' ? cameraPreview.context.readiness : cameraPreview?.context.tracking;
  const posePreview=!!(cameraPreview && poseOptions && nativePoseAvailable);

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      {loadedAddress ? <WebView
        ref={webRef}
        key={key}
        source={{ uri: loadedAddress }}
        style={StyleSheet.absoluteFill}
        containerStyle={styles.webContainer}
        originWhitelist={[new URL(loadedAddress).origin]}
        onShouldStartLoadWithRequest={request => isTrustedWebViewUrl(request.url, loadedAddress)}
        injectedJavaScriptBeforeContentLoaded={insetScript}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled={false}
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState
        bounces={false}
        overScrollMode="never"
        scrollEnabled
        showsVerticalScrollIndicator
        showsHorizontalScrollIndicator
        indicatorStyle="white"
        cacheEnabled={false}
        incognito={false}
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        scalesPageToFit={false}
        textZoom={Math.round(fontScale * 100)}
        renderLoading={() => (
          <View style={[styles.loading, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
            <ActivityIndicator size="large" color="#22c55e" />
          </View>
        )}
        onError={(e) => {
          monitor.current?.stop();
          stopNativeCamera();
          console.error('WebView error:', e.nativeEvent);
          setError(true);
        }}
        onHttpError={e => {
          console.error('HTTP error:', e.nativeEvent);
          if (e.nativeEvent.statusCode >= 500) {stopNativeCamera();setError(true);}
        }}
        onMessage={(e) => {
          if (!isTrustedWebViewUrl(e.nativeEvent.url, loadedAddress)) return;
          try {
            if(e.nativeEvent.data.length>readinessMessageLimit){stopNativeCamera();return;}
            const message = JSON.parse(e.nativeEvent.data) as {
              type?: string;
              ok?: boolean;
              frame?: CameraFrame;
              facing?: 'back' | 'front';
              previewContext?: unknown;
              requestId?: string;
              side?: 'left' | 'right';
              sessionId?: string;
              geometryGeneration?: number;
              framing?: unknown;
            };
            if (message.type === 'backend-status') setBackendStatus(message.ok ? 'online' : 'offline');
            if (message.type === 'request-camera-permission') void requestCameraPermission();
            if (message.type === 'request-device-readiness') void publishReadiness();
            if (message.type === 'pose-status' && !nativePoseAvailable) {
              webRef.current?.injectJavaScript(poseScript({ type: 'error', requestId: message.requestId, side: message.side, message: 'Camera rep counting needs a development build. Camera preview and manual counting are available.' }));
            }
            if (message.type === 'camera-start' && message.frame) {
              const requestId = cameraRequestId.current + 1;
              cameraRequestId.current = requestId;
              setCameraPreview(null);
              if(!isNativeCameraContext(message.previewContext)){stopNativeCamera();return;}
              const context = message.previewContext;
              void startNativeCamera(message.frame, message.facing === 'front' ? 'front' : 'back', context, requestId);
            }
            if (message.type === 'camera-update-frame' && message.frame) {
              if(!isNativeCameraContext(message.previewContext) || !isCameraFrame(message.frame) ||
                (message.previewContext.screen==='camera-check' && (message.previewContext.readiness.previewWidth!==message.frame.width || message.previewContext.readiness.previewHeight!==message.frame.height))) {stopNativeCamera();return;}
              const context = message.previewContext;
              updateNativeCameraFrame(message.frame, context);
            }
            if (message.type === 'camera-update-overlay') {
              if(!isNativeCameraContext(message.previewContext)){stopNativeCamera();return;}
              updateNativeCameraContext(message.previewContext);
            }
            if(message.type==='camera-readiness-status' && cameraPreview?.context.screen==='camera-check') {
              const context=cameraPreview.context.readiness;
              if(message.sessionId===context.sessionId && message.geometryGeneration===context.geometryGeneration) {
                setFraming(validateReadinessCheck(message.framing)?message.framing:{status:'unknown',reason:'invalid'});
              }
            }
            if (message.type === 'camera-stop') stopNativeCamera();
            const native = monitor.current;
            if (native && message.type?.startsWith('inactivity-')) {
              if (message.type === 'inactivity-start' || message.type === 'inactivity-im-okay' || message.type === 'inactivity-hold-stop') {
                stopNativeCamera();
              }
              const payload = JSON.parse(e.nativeEvent.data) as { type: string; thresholdMs?: number };
              if (payload.type === 'inactivity-start') void native.start(payload.thresholdMs ?? 30_000);
              if (payload.type === 'inactivity-stop') native.stop();
              if (payload.type === 'inactivity-im-okay') native.imOkay();
              if (payload.type === 'inactivity-hold-stop') native.holdStop();
              if (payload.type === 'inactivity-request-motion-status') void native.reportMotionStatus();
            }
          } catch (error) {
            stopNativeCamera();
            console.warn('Could not handle malformed WebView message.');
          }
        }}
        onLoadStart={() => {
          monitor.current?.stop();
          stopNativeCamera();
          console.log('WebView load started:', loadedAddress);
        }}
        onLoadEnd={(e) => {
          console.log('WebView load ended:', e.nativeEvent.url);
          pushInsets();
          checkBackend();
          void publishReadiness();
        }}
        onContentProcessDidTerminate={() => {
          monitor.current?.stop();
          stopNativeCamera();
          console.error('WebView process terminated');
          setError(true);
        }}
      /> : null}
      {cameraPreview && poseOptions && posePreview && (
        <NativeTrackingCamera
          key={`${cameraPreview.instanceId}-${poseOptions.mode==='readiness'?poseOptions.sessionId:poseOptions.requestId}-${cameraPreview.facing}`}
          options={poseOptions}
          facing={cameraPreview.facing}
          style={[styles.nativeCameraPreview, { left: cameraPreview.frame.x, top: cameraPreview.frame.y, width: cameraPreview.frame.width, height: cameraPreview.frame.height }]}
          emit={detail => {
            if(cameraPreview.instanceId!==cameraRequestId.current)return;
            webRef.current?.injectJavaScript(poseOptions.mode==='readiness'?readinessScript(detail):poseScript(detail));
            if (detail.type === 'error') {
              setCameraPreview(null);
              webRef.current?.injectJavaScript(buildCameraScript({ type: 'status', status: 'unavailable', message: String(detail.message) }));
            }
          }}
          ready={() => {if(cameraPreview.instanceId===cameraRequestId.current)webRef.current?.injectJavaScript(buildCameraScript({ type: 'status', status: 'on' }));}}
        />
      )}
      {cameraPreview && !posePreview && (
        <CameraView
          key={cameraPreview.facing}
          facing={cameraPreview.facing}
          mirror={cameraPreview.facing === 'front'}
          style={[
            styles.nativeCameraPreview,
            {
              left: cameraPreview.frame.x,
              top: cameraPreview.frame.y,
              width: cameraPreview.frame.width,
              height: cameraPreview.frame.height,
            },
          ]}
          onCameraReady={() => {
            if(cameraPreview.instanceId!==cameraRequestId.current)return;
            webRef.current?.injectJavaScript(buildCameraScript({ type: 'status', status: 'on' }));
            if(cameraPreview.context.screen==='camera-check') {
              const {sessionId,geometryGeneration}=cameraPreview.context.readiness;
              webRef.current?.injectJavaScript(readinessScript({type:'capability',sessionId,geometryGeneration,reason:'unsupported'}));
            }
            if (cameraPreview.context.screen === 'live-session' && cameraPreview.context.tracking) {
              webRef.current?.injectJavaScript(poseScript({ type: 'error', requestId: cameraPreview.context.tracking.requestId, side: cameraPreview.context.tracking.side, message: 'Camera rep counting needs a development build. Camera preview and manual counting are available.' }));
            }
          }}
          onMountError={event => {
            if(cameraPreview.instanceId!==cameraRequestId.current)return;
            console.error('Native camera preview failed:', event.message);
            setCameraPreview(null);
            webRef.current?.injectJavaScript(buildCameraScript({
              type: 'status',
              status: 'unavailable',
              message: event.message || 'The camera could not start. Try again.',
            }));
          }}
        />
      )}
      {cameraPreview && (
        <View
          pointerEvents="box-none"
          accessible={false}
          style={[
            styles.nativeCameraOverlay,
            {
              left: cameraPreview.frame.x,
              top: cameraPreview.frame.y,
              width: cameraPreview.frame.width,
              height: cameraPreview.frame.height,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${cameraPreview.facing === 'back' ? 'front' : 'back'} camera`}
            onPress={switchNativeCameraFacing}
            style={styles.nativeCameraFacing}
          >
            <Text style={styles.nativeCameraFacingText}>
              {cameraPreview.facing === 'back' ? 'Front camera' : 'Back camera'}
            </Text>
          </Pressable>
          {cameraPreview.context.screen === 'camera-check' ? (
            <>
              <View style={styles.nativeCameraFrame}>
                <View style={[styles.nativeCameraCorner, styles.nativeCameraCornerTL]} />
                <View style={[styles.nativeCameraCorner, styles.nativeCameraCornerTR]} />
                <View style={[styles.nativeCameraCorner, styles.nativeCameraCornerBL]} />
                <View style={[styles.nativeCameraCorner, styles.nativeCameraCornerBR]} />
              </View>
              <View style={styles.nativeCameraDistance}>
                <View style={styles.nativeCameraDot} />
                <Text style={styles.nativeCameraDistanceText}>{nativeFramingText(framing)}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.nativeCameraFormBadge}>
                <Text style={styles.nativeCameraFormText}>Form analysis unavailable</Text>
              </View>
              <View style={styles.nativeCameraTimeCard}>
                <Text style={styles.nativeCameraSmallText}>Elapsed</Text>
                <Text style={styles.nativeCameraTimeText}>{cameraPreview.context.elapsed}</Text>
              </View>
              <View style={styles.nativeCameraExercise}>
                <Text style={styles.nativeCameraSmallText}>{cameraPreview.context.equipment}</Text>
                <Text numberOfLines={1} style={styles.nativeCameraExerciseText}>{cameraPreview.context.exerciseName}</Text>
              </View>
            </>
          )}
        </View>
      )}
      {loadedAddress && !error && backendStatus === 'offline' && (
        <View style={[styles.backendBanner, { top: insets.top + 8, left: insets.left + 12, right: insets.right + 12 }]}>
          <Text style={styles.backendBannerText}>Backend unavailable · server-backed features cannot sync</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry backend connection check" style={styles.retryButton} onPress={checkBackend}><Text style={styles.retryText}>Retry backend check</Text></Pressable>
        </View>
      )}
      {loadedAddress && !error && readiness?.cameraPermission === 'denied' && (
        <View style={[styles.permissionBanner, { top: insets.top + 62, left: insets.left + 12, right: insets.right + 12 }]}>
          <Text style={styles.permissionText}>Camera permission is blocked. Enable it in your phone settings to use camera features.</Text>
        </View>
      )}
      {error && (
        <ScrollView
          contentContainerStyle={styles.errorScroll}
          style={[
            styles.errorOverlay,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
              paddingLeft: insets.left + 16,
              paddingRight: insets.right + 16,
            },
          ]}
        >
          <View style={[styles.errorCard, { maxWidth: cardMax, padding: cardPad }]}>
            <Text style={[styles.title, { fontSize: Math.round(bodySize * 1.45) }]}>
              Can't reach PhysiqueQuest
            </Text>
            <Text style={[styles.body, { fontSize: bodySize, lineHeight: bodySize * 1.6 }]}>
              Start the web app, backend, and database connection on your computer. Keep your phone and
              computer on the same Wi-Fi network, then enter the computer's LAN address on port 3000.
            </Text>
            <Text style={[styles.label, { fontSize: bodySize - 1 }]}>Computer address</Text>
            <TextInput
              accessibilityLabel="Computer address"
              accessibilityHint="Enter the frontend server URL to connect PhysiqueQuest"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onChangeText={setAddress}
              onSubmitEditing={connect}
              placeholder="http://192.168.1.10:3000"
              returnKeyType="go"
              style={[styles.input, { minHeight: bodySize * 3.1, fontSize: bodySize, paddingHorizontal: 14 }]}
              value={address}
            />
            <Pressable
              accessibilityRole="button"
              onPress={connect}
              style={[styles.button, { minHeight: bodySize * 3.3 }]}
            >
              <Text style={[styles.buttonText, { fontSize: bodySize }]}>Connect</Text>
            </Pressable>
            <Text style={[styles.hint, { fontSize: bodySize - 2, lineHeight: (bodySize - 2) * 1.55 }]}>
              The computer address is usually printed beside "Network" when Next.js starts.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0f15' },
  webContainer: { flex: 1, backgroundColor: '#0b0f15' },
  nativeCameraPreview: {
    position: 'absolute',
    zIndex: 10,
    elevation: 10,
    overflow: 'hidden',
    borderRadius: 18,
  },
  nativeCameraOverlay: {
    position: 'absolute',
    zIndex: 11,
    elevation: 11,
    overflow: 'hidden',
    borderRadius: 18,
  },
  nativeCameraFacing: {
    position: 'absolute',
    zIndex: 12,
    top: 12,
    right: 12,
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: '#273444',
    borderRadius: 18,
    backgroundColor: '#161d27ee',
  },
  nativeCameraFacingText: { color: '#f8fafc', fontSize: 11, fontWeight: '600' },
  nativeCameraFrame: {
    position: 'absolute',
    top: '8%',
    right: '18%',
    bottom: '8%',
    left: '18%',
    borderRadius: 25,
  },
  nativeCameraCorner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: '#22c55e',
  },
  nativeCameraCornerTL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 10 },
  nativeCameraCornerTR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 10 },
  nativeCameraCornerBL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 10 },
  nativeCameraCornerBR: { right: 0, bottom: 0, borderRightWidth: 2, borderBottomWidth: 2, borderBottomRightRadius: 10 },
  nativeCameraDistance: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#161d27',
  },
  nativeCameraDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  nativeCameraDistanceText: { color: '#f8fafc', fontSize: 12 },
  nativeCameraFormBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#161d27ee',
  },
  nativeCameraFormText: { color: '#f8fafc', fontSize: 11 },
  nativeCameraTimeCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#161d27',
  },
  nativeCameraExercise: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    maxWidth: '60%',
    alignItems: 'flex-end',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#161d27ee',
  },
  nativeCameraSmallText: { color: '#94a3b8', fontSize: 11 },
  nativeCameraTimeText: { color: '#f8fafc', fontSize: 22, fontVariant: ['tabular-nums'] },
  nativeCameraExerciseText: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#0b0f15',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0b0f15',
  },
  errorScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  errorCard: { width: '100%', backgroundColor: '#161d27' },
  title: { marginBottom: 10, color: '#f8fafc', fontWeight: '700' },
  body: { color: '#94a3b8' },
  code: { color: '#f8fafc', fontWeight: '700' },
  label: { marginTop: 20, marginBottom: 6, color: '#f8fafc', fontWeight: '600' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#273444',
    color: '#f8fafc',
  },
  button: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#22c55e',
  },
  buttonText: { color: '#0b0f15', fontWeight: '700' },
  hint: { marginTop: 12, color: '#94a3b8' },
  backendBanner: {
    position: 'absolute',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#480909',
    borderWidth: 1,
    borderColor: '#f87171',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  backendBannerText: { flex: 1, color: '#f87171', fontSize: 12, fontWeight: '600' },
  retryText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  retryButton: { minWidth: 48, minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  permissionBanner: {
    position: 'absolute',
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#480909',
    borderWidth: 1,
    borderColor: '#f87171',
  },
  permissionText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
});
