import { handleOfflineAccount } from './offlineAccount';
import Constants from 'expo-constants';
import { googleSignInError } from './googleSignInError';
import FoodScannerCamera, { type FoodCameraRequest } from './FoodScannerCamera';
import { Camera, CameraView } from 'expo-camera';
import type { GoogleSignin as GoogleSigninApi } from '@react-native-google-signin/google-signin';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  ActivityIndicator,
  Modal,
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
import { backendIsReady, isTrustedWebViewUrl, isTrustedWebViewNavigation, normalizeFrontendUrl, resolveApiUrl, resolveFrontendUrl, selectConfiguredUrl } from './connection.mjs';
import { performanceGuardScript } from './performance-guard.mjs';
import { createNativeMonitor } from './inactivity/nativeMonitor';
import NativeTrackingCamera, { nativePoseAvailable, poseScript, type NativeTrackingOptions } from './NativeTrackingCamera';
import PoseTrackerNative from './PoseTrackerNative';
import type { NativePoseSummary } from '../shared/poseSessionSummary';
import { readinessMessageLimit, readinessScript, validateNativeReadinessContext, validateReadinessCheck, type NativeReadinessContext, type ReadinessCheck } from '../shared/cameraReadiness';
import type { ExerciseConfigOverride } from '../shared/exerciseEngine';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

declare const process: { env: { EXPO_PUBLIC_WEB_APP_URL?: string; EXPO_PUBLIC_API_URL?: string; EXPO_PUBLIC_PQ_LOCAL_DEV?: string } };
type RuntimeExtra = { EXPO_PUBLIC_WEB_APP_URL?: string; EXPO_PUBLIC_API_URL?: string; googleWebClientId?: string; googleIosClientId?: string };

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
type NativeCameraPreview = { frame: CameraFrame; facing: 'back' | 'front'; context: NativeCameraContext; instanceId: number; generation?: number };

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
/** Ignore malformed bridge input without changing ownership of a live camera. */
export function parseCameraHostMessage(raw: string): Record<string,unknown> | null {
  if(typeof raw!=='string' || raw.length>4000500)return null;
  try {
    const m=JSON.parse(raw);
    if(!m || typeof m!=='object' || Array.isArray(m) || typeof m.type!=='string')return null;
    if(['camera-start','camera-update-frame'].includes(m.type)) {
      if(!isCameraFrame(m.frame) || !isNativeCameraContext(m.previewContext))return null;
      if(m.previewContext.screen==='camera-check' && (m.previewContext.readiness.previewWidth!==m.frame.width || m.previewContext.readiness.previewHeight!==m.frame.height))return null;
    }
    if(m.type==='camera-start' && !['front','back'].includes(m.facing))return null;
    if(m.type==='camera-start' && m.generation!==undefined && (!Number.isSafeInteger(m.generation) || m.generation<0))return null;
    if(m.type==='camera-update-overlay' && !isNativeCameraContext(m.previewContext))return null;
    return m;
  }catch{return null;}
}
export function nativeFramingText(check:ReadinessCheck) {
  if(!validateReadinessCheck(check))return 'Framing unavailable';
  if(check.status==='ready')return 'Framing ready';
  return ({'too-small':'Move a little closer','too-large':'Move a little farther away','clipped':'Keep your whole body in view',pending:'Checking framing…',uncalibrated:'Framing validation pending',bent:'Stand upright to check framing'} as Partial<Record<ReadinessCheck['reason'],string>>)[check.reason]??'Framing unavailable';
}

function getInitialAddress() {
  if (Platform.OS === 'android' && NativeModules.PQShell?.standalone === true) return 'https://appassets.androidplatform.net/?pq-shell=1.1.0-badge-progression';
  const extra = Constants.expoConfig?.extra as { EXPO_PUBLIC_WEB_APP_URL?: string } | undefined;
  return resolveFrontendUrl(selectConfiguredUrl(process.env.EXPO_PUBLIC_PQ_LOCAL_DEV === '1', process.env.EXPO_PUBLIC_WEB_APP_URL, extra?.EXPO_PUBLIC_WEB_APP_URL), Constants.expoConfig?.hostUri);
}

/**
 * Publishes the native safe-area insets (status bar, Android gesture/nav bar,
 * display cutouts) to the web document as CSS custom properties so the web app
 * can pad its content clear of the system UI.
 */
function buildInsetsScript(insets: { top: number; bottom: number; left: number; right: number }, apiUrl: string, fontScale: number) {
  const { top, bottom, left, right } = insets;
  const encodedApiUrl = JSON.stringify(apiUrl);
  return `${__DEV__ ? performanceGuardScript : ''}(function(){try{
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

/** Delivers a host event to the WebView as the `physiquequest-inactivity` CustomEvent. */
function buildInactivityScript(detail: Record<string, unknown>) {
  const payload = JSON.stringify(detail).replace(/</g, '\\u003c');
  return `(function(){window.dispatchEvent(new CustomEvent('physiquequest-inactivity',{detail:${payload}}));})();true;`;
}

function buildReadinessScript(readiness: DeviceReadiness) {
  const payload = JSON.stringify(readiness).replace(/</g, '\\u003c');
  return `(function(){window.dispatchEvent(new CustomEvent('physiquequest-device-readiness',{detail:${payload}}));})();true;`;
}

function buildGoogleAuthScript(result: { requestId: string; idToken?: string; error?: string; cancelled?: boolean }) {
  const payload = JSON.stringify(result).replace(/</g, '\\u003c');
  return `(function(){window.dispatchEvent(new CustomEvent('physiquequest-google-auth-result',{detail:${payload}}));})();true;`;
}

function buildCameraScript(detail: {
  type: string;
  active?: boolean;
  reason?: string;
  generation?: number;
  status?: string;
  message?: string;
  requestId?: string;
  mediaBase64?: string;
  facing?: 'back' | 'front';
}) {
  const payload = JSON.stringify(detail).replace(/</g, '\\u003c');
  return `(function(){window.dispatchEvent(new CustomEvent('physiquequest-camera',{detail:${payload}}));})();true;`;
}

function AppContent({ onAuthenticated }: { onAuthenticated: () => void }) {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView<object>>(null);
  const googleConfigured = useRef(false);
  const googleSignin = useRef<typeof GoogleSigninApi | null>(null);
  const pendingNotificationOpen = useRef(false);
  const requestPush = useCallback(async () => {
    let detail: { token?: string; error?: string };
    try {
      if (!Device.isDevice) throw new Error('Phone notifications require a physical device.');
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) throw new Error('Phone notifications are not configured for this build.');
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Notifications', importance: Notifications.AndroidImportance.DEFAULT });
      const existing = await Notifications.getPermissionsAsync();
      const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
      if (!permission.granted) throw new Error('Notification permission is off. Enable it in your phone settings.');
      detail = { token: (await Notifications.getExpoPushTokenAsync({ projectId })).data };
    } catch (error) { detail = { error: error instanceof Error ? error.message : 'Could not enable phone notifications.' }; }
    webRef.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('physiquequest-push-registration',{detail:${JSON.stringify(detail).replace(/</g, '\\u003c')}}));true;`);
  }, []);
  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => webRef.current?.injectJavaScript("window.dispatchEvent(new Event('physiquequest-notification-received'));true;"));
    const opened = Notifications.addNotificationResponseReceivedListener(() => { pendingNotificationOpen.current = true; Notifications.clearLastNotificationResponse(); webRef.current?.injectJavaScript("window.location.assign('/home/notifications');true;"); });
    void Notifications.getLastNotificationResponseAsync().then(response => { if (response) { pendingNotificationOpen.current = true; Notifications.clearLastNotificationResponse(); webRef.current?.injectJavaScript("window.location.assign('/home/notifications');true;"); } });
    return () => { received.remove(); opened.remove(); };
  }, []);
  const { width, fontScale } = useWindowDimensions();
  const inferredAddress = useMemo(getInitialAddress, []);
  const extra = Constants.expoConfig?.extra as RuntimeExtra | undefined;
  useEffect(() => {
    googleConfigured.current = false;
    googleSignin.current = null;
    // Expo Go does not include this native module. Never evaluate its package
    // until the host confirms it exists: the package uses getEnforcing on import.
    if (Constants.appOwnership === 'expo' || !TurboModuleRegistry.get('RNGoogleSignin')) return;
    const webClientId = extra?.googleWebClientId;
    const iosClientId = extra?.googleIosClientId;
    if (!webClientId || (Platform.OS === 'ios' && !iosClientId)) return;
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin') as { GoogleSignin: typeof GoogleSigninApi };
      GoogleSignin.configure({ webClientId, ...(iosClientId ? { iosClientId } : {}) });
      googleSignin.current = GoogleSignin;
      googleConfigured.current = true;
    } catch { /* Keep password sign-in available in an incompatible host. */ }
  }, [extra?.googleIosClientId, extra?.googleWebClientId]);
  const [address, setAddress] = useState(inferredAddress ?? '');
  const [loadedAddress, setLoadedAddress] = useState(inferredAddress);
  const [manualApiUrl, setManualApiUrl] = useState<string | null>(null);
  const apiUrl = useMemo(() => {
    if (!loadedAddress) return null;
    let configured = manualApiUrl ?? selectConfiguredUrl(process.env.EXPO_PUBLIC_PQ_LOCAL_DEV === '1', process.env.EXPO_PUBLIC_API_URL, extra?.EXPO_PUBLIC_API_URL);
    if (NativeModules.PQShell?.standalone === true) {
      configured = extra?.EXPO_PUBLIC_API_URL;
      try {
        const url = new URL(configured ?? '');
        if (url.protocol !== 'https:' || url.hostname.endsWith('.trycloudflare.com') || url.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) return null;
      } catch { return null; }
    }
    return resolveApiUrl(configured, loadedAddress);
  }, [extra?.EXPO_PUBLIC_API_URL, loadedAddress, manualApiUrl]);
  const [error, setError] = useState(!inferredAddress);
  const [key, setKey] = useState(0);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [readiness, setReadiness] = useState<DeviceReadiness | null>(null);
  const [cameraPreview, setCameraPreview] = useState<NativeCameraPreview | null>(null);
  const [providerSession, setProviderSession] = useState<{token?:string;exercise:string;name:string;pattern:string;support:string;contactName?:string;override?:ExerciseConfigOverride}|null>(null);
  const [poseDeliveryStatus, setPoseDeliveryStatus] = useState<'idle' | 'pending' | 'delivered' | 'failed'>('idle');
  const poseSafetyAlarm = useCallback(() => {
    setPoseDeliveryStatus('pending');
    webRef.current?.injectJavaScript("window.dispatchEvent(new CustomEvent('physiquequest-pose-safety',{detail:{type:'alarm'}}));true;");
  }, []);
  const poseSafetyStop = useCallback(() => {
    webRef.current?.injectJavaScript("window.dispatchEvent(new CustomEvent('physiquequest-pose-safety',{detail:{type:'stop'}}));true;");
  }, []);
  const closeProviderSession = useCallback((summary?: NativePoseSummary) => {
    setProviderSession(null);
    const detail = JSON.stringify(summary ?? null).replace(/</g, '\\u003c');
    webRef.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('physiquequest-posetracker-closed',{detail:${detail}}));true;`);
  }, []);
  const [foodCamera, setFoodCamera] = useState<FoodCameraRequest | null>(null);
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

  const probe = useRef<AbortController | null>(null);
  const networkAvailable = useRef<boolean | null>(null);
  const backendStatusRef = useRef(backendStatus);
  backendStatusRef.current = backendStatus;
  const checkBackend = useCallback(async () => {
    if (networkAvailable.current === false || probe.current) return;
    const controller = new AbortController();
    probe.current = controller;
    // A free server can take nearly a minute to wake. Keep a single startup
    // request alive instead of repeatedly aborting it and reporting offline.
    const timeout = setTimeout(() => controller.abort(), backendStatusRef.current === 'online' ? 7000 : 65000);
    try {
      const ready = apiUrl && await backendIsReady(apiUrl, controller.signal);
      if (probe.current === controller) setBackendStatus(ready ? 'online' : 'offline');
    } finally { clearTimeout(timeout); if (probe.current === controller) probe.current = null; }
  }, [apiUrl]);

  useEffect(() => {
    const checkIfActive = () => { if (AppState.currentState === 'active') void checkBackend(); };
    const applyNetworkState = (available: boolean) => {
      networkAvailable.current = available;
      webRef.current?.injectJavaScript(
        `window.dispatchEvent(new CustomEvent('physiquequest:internet-status',{detail:${JSON.stringify(available ? 'online' : 'offline')}}));true;`
      );
      if (!available) {
        probe.current?.abort();
        probe.current = null;
        setBackendStatus('offline');
      } else checkIfActive();
    };
    const unsubscribe = NetInfo.addEventListener(state => {
      applyNetworkState(state.isConnected !== false && state.isInternetReachable !== false);
    });
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      void NetInfo.fetch().then(network => {
        applyNetworkState(network.isConnected !== false && network.isInternetReachable !== false);
      });
    });
    return () => {
      unsubscribe();
      subscription.remove();
      probe.current?.abort();
      probe.current = null;
    };
  }, [checkBackend]);

  useEffect(() => {
    if (backendStatus !== 'checking') webRef.current?.injectJavaScript(
      `window.dispatchEvent(new CustomEvent('physiquequest:backend-status',{detail:${JSON.stringify(backendStatus)}}));true;`
    );
  },[backendStatus]);

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
    generation?: number,
  ) => {
    const validFrame = isCameraFrame(frame) && (context.screen!=='camera-check' ||
      (context.readiness.previewWidth===frame.width && context.readiness.previewHeight===frame.height));
    if (!validFrame) {
      webRef.current?.injectJavaScript(buildCameraScript({
        type: 'status', generation,
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
          type: 'status', generation,
          status: 'denied',
          message: 'Camera access is blocked. Allow camera access in your phone settings, then try again.',
        }));
        return;
      }
      setFraming({status:'unknown',reason:'pending'});
      setCameraPreview({ frame, facing, context, instanceId:requestId, generation });
      webRef.current?.injectJavaScript(buildCameraScript({ type: 'status', status: 'starting', generation }));
    } catch (error) {
      console.error('Native camera could not start:', error);
      if (requestId !== cameraRequestId.current) return;
      webRef.current?.injectJavaScript(buildCameraScript({
        type: 'status', generation,
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
    let blurred=false;
    const signal=(active:boolean)=>webRef.current?.injectJavaScript(buildCameraScript({type:'interruption',active}));
    const change=AppState.addEventListener('change',state=>{if(state!=='active'){stopNativeCamera();signal(false);}else {blurred=false;signal(true);}});
    const blur=AppState.addEventListener('blur',()=>{blurred=true;stopNativeCamera();signal(false);});
    const focus=AppState.addEventListener('focus',()=>{blurred=false;signal(AppState.currentState==='active');});
    return ()=>{cameraRequestId.current++;change.remove();blur.remove();focus.remove();};
  },[stopNativeCamera]);

  const switchNativeCameraFacing = () => {
    const nextFacing = cameraPreview?.facing === 'back' ? 'front' : 'back';
    setCameraPreview(current => current ? { ...current, facing: nextFacing } : current);
    setFraming({status:'unknown',reason:'pending'});
    webRef.current?.injectJavaScript(buildCameraScript({ type: 'facing', facing: nextFacing }));
  };

  const connect = () => {
    const normalized = normalizeFrontendUrl(address);
    const nextApiUrl = normalized ? resolveApiUrl(undefined, normalized) : null;
    if (!normalized || !nextApiUrl) {
      setError(true);
      return;
    }
    setAddress(normalized);
    setLoadedAddress(normalized);
    setManualApiUrl(nextApiUrl);
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
      <StatusBar barStyle="light-content" />
      {loadedAddress ? <WebView<object>
        ref={webRef}
        key={key}
        source={{ uri: loadedAddress }}
        style={StyleSheet.absoluteFill}
        containerStyle={styles.webContainer}
        originWhitelist={[new URL(loadedAddress).origin, 'https://app.posetracker.com']}
        onShouldStartLoadWithRequest={request => isTrustedWebViewNavigation(request.url, loadedAddress, request.isTopFrame)}
        injectedJavaScriptBeforeContentLoaded={insetScript}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled={Platform.OS === 'android' && NativeModules.PQShell?.standalone === true}
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
          setFoodCamera(null);
          monitor.current?.stop();
          stopNativeCamera();
          console.log('WebView connection failed:', e.nativeEvent.code);
          setError(true);
        }}
        onHttpError={e => {
          console.log('WebView HTTP error:', e.nativeEvent.statusCode);
          if (e.nativeEvent.statusCode >= 500) {stopNativeCamera();setError(true);}
        }}
        onMessage={(e) => {
          if (!isTrustedWebViewUrl(e.nativeEvent.url, loadedAddress)) return;
          try {
            const parsedMessage=parseCameraHostMessage(e.nativeEvent.data);
            if(!parsedMessage)return;
            const message = parsedMessage as {
              type?: string;
              mode?: string;
              ok?: boolean;
              frame?: CameraFrame;
              facing?: 'back' | 'front';
              previewContext?: unknown;
              requestId?: string;
              generation?: number;
              side?: 'left' | 'right';
              sessionId?: string;
              geometryGeneration?: number;
              framing?: unknown;
              token?: string;
              intent?: string;
              exercise?: string;
              name?: string;
              pattern?: string;
              support?: string;
              contactName?: string;
              override?: unknown;
              status?: string;
              image?: string;
            };
            if (message.type === 'auth-success') { onAuthenticated(); return; }
            if (message.type === 'badge-export' && typeof message.requestId === 'string' && /^[a-zA-Z0-9-]{8,100}$/.test(message.requestId) && typeof message.image === 'string' && message.image.startsWith('data:image/png;base64,') && typeof message.name === 'string' && (message.intent === 'save' || message.intent === 'share')) {
              const requestId = message.requestId, origin = new URL(loadedAddress).origin;
              const respond = (error?: string) => { const detail = JSON.stringify({ requestId, error }); webRef.current?.injectJavaScript(`if(location.origin===${JSON.stringify(origin)})window.dispatchEvent(new CustomEvent('physiquequest:badge-export',{detail:${detail}}));true;`); };
              if (!NativeModules.PQShell?.exportBadge) respond('Saving images is unavailable in this app version.');
              else void NativeModules.PQShell.exportBadge(message.image, message.name, message.intent).then(() => respond()).catch((error: Error) => respond(error.message || 'Could not export the image.'));
              return;
            }
            if(e.nativeEvent.data.length>readinessMessageLimit){stopNativeCamera();return;}
            if (apiUrl && ['remember-offline-account','forget-offline-account','restore-offline-account'].includes(message.type ?? '') &&
                typeof message.requestId === 'string' && /^[a-zA-Z0-9-]{8,120}$/.test(message.requestId)) {
              const origin = new URL(loadedAddress).origin;
              void handleOfflineAccount(message.type!,origin,apiUrl,message.token).catch(()=>null).then(grant => {
                const detail = JSON.stringify({requestId:message.requestId,account:grant ? {id:grant.id,expiresAt:grant.expiresAt} : null});
                webRef.current?.injectJavaScript(`if(location.origin===${JSON.stringify(origin)})window.dispatchEvent(new CustomEvent('physiquequest:offline-account',{detail:${detail}}));true;`);
              });
              return;
            }
            if (message.type === 'google-sign-in' && typeof message.requestId === 'string' &&
              /^[a-zA-Z0-9-]{8,100}$/.test(message.requestId) && ['login', 'register'].includes(message.intent ?? '')) {
              const requestId = message.requestId;
              if (!googleSignin.current) {
                webRef.current?.injectJavaScript(buildGoogleAuthScript({ requestId, error: 'Google sign-in requires the PhysiqueQuest development or installed app. In Expo Go, use email and password.' }));
                return;
              }
              void (async () => {
                try {
                  const GoogleSignin = googleSignin.current!;
                  if (!googleConfigured.current) throw new Error('Google sign-in is not configured in this build.');
                  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
                  // Always show the account chooser so the user can select a different Google account.
                  await GoogleSignin.signOut().catch(() => undefined);
                  const result = await GoogleSignin.signIn();
                  if (result.type === 'cancelled') {
                    webRef.current?.injectJavaScript(buildGoogleAuthScript({ requestId, cancelled: true }));
                  } else if (result.data.idToken) {
                    webRef.current?.injectJavaScript(buildGoogleAuthScript({ requestId, idToken: result.data.idToken }));
                  } else {
                    webRef.current?.injectJavaScript(buildGoogleAuthScript({ requestId, error: 'Google did not return an identity token. Please try again.' }));
                  }
                } catch (error) {
                  webRef.current?.injectJavaScript(buildGoogleAuthScript({ requestId, ...googleSignInError(error) }));
                }
              })();
            }
            if (message.type === 'posetracker-native-start' && typeof message.exercise === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(message.exercise) && typeof message.name === 'string' && message.name.length <= 160 && typeof message.pattern === 'string' && /^[a-z_]{1,40}$/.test(message.pattern) && ['FULLY_SUPPORTED','PARTIALLY_SUPPORTED','NOT_YET_VALIDATED'].includes(message.support ?? '')) {
              stopNativeCamera();
              setPoseDeliveryStatus('idle');
              setProviderSession({token:typeof message.token === 'string' && message.token.length <= 200 ? message.token : undefined,exercise:message.exercise,name:message.name,pattern:message.pattern,support:message.support!,contactName:typeof message.contactName === 'string' && message.contactName.length <= 100 ? message.contactName : undefined,override:message.override&&typeof message.override==='object'&&!Array.isArray(message.override)?message.override as ExerciseConfigOverride:undefined});
            }
            if (message.type === 'posetracker-native-stop') setProviderSession(null);
            if (message.type === 'pose-safety-status' && providerSession && ['pending', 'delivered', 'failed'].includes(message.status ?? '')) setPoseDeliveryStatus(message.status as 'pending' | 'delivered' | 'failed');
            if (message.type === 'food-camera-start' && typeof message.requestId === 'string' && message.requestId.length <= 100 && message.mode === 'photo' && isCameraFrame(message.frame)) {
              stopNativeCamera();
              setFoodCamera({ requestId: message.requestId, mode: 'photo', frame: message.frame!, facing: message.facing === 'front' ? 'front' : 'back', capture: 0 });
            }
            if (message.type === 'food-camera-frame' && isCameraFrame(message.frame)) setFoodCamera(current => current && current.requestId === message.requestId ? { ...current, frame: message.frame! } : current);
            if (message.type === 'food-camera-capture') setFoodCamera(current => current && current.requestId === message.requestId && current.mode === 'photo' ? { ...current, capture: current.capture + 1 } : current);
            if (message.type === 'food-camera-stop') setFoodCamera(current => current?.requestId === message.requestId ? null : current);
            if (message.type === 'request-camera-permission') void requestCameraPermission();
            if (message.type === 'request-push-permission') void requestPush();
            if (message.type === 'request-device-readiness') void publishReadiness();
            if (message.type === 'pose-status' && !nativePoseAvailable) {
              webRef.current?.injectJavaScript(poseScript({ type: 'error', requestId: message.requestId, side: message.side, message: 'Camera rep counting needs a development build. Camera preview and manual counting are available.' }));
            }
            if (message.type === 'camera-start' && message.frame) {
              const requestId = cameraRequestId.current + 1;
              cameraRequestId.current = requestId;
              setCameraPreview(null);
              if(!isNativeCameraContext(message.previewContext))return;
              const context = message.previewContext;
              void startNativeCamera(message.frame, message.facing === 'front' ? 'front' : 'back', context, requestId, message.generation);
            }
            if (message.type === 'camera-update-frame' && message.frame) {
              if(!isNativeCameraContext(message.previewContext) || !isCameraFrame(message.frame) ||
                (message.previewContext.screen==='camera-check' && (message.previewContext.readiness.previewWidth!==message.frame.width || message.previewContext.readiness.previewHeight!==message.frame.height))) return;
              const context = message.previewContext;
              updateNativeCameraFrame(message.frame, context);
            }
            if (message.type === 'camera-update-overlay') {
              if(!isNativeCameraContext(message.previewContext))return;
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
            console.warn('Could not handle malformed WebView message.');
          }
        }}
        onLoadStart={() => {
          setFoodCamera(null);
          monitor.current?.stop();
          stopNativeCamera();
          console.log('WebView load started:', loadedAddress);
        }}
        onLoadEnd={(e) => {
          console.log('WebView load ended:', e.nativeEvent.url);
          if (pendingNotificationOpen.current && isTrustedWebViewUrl(e.nativeEvent.url, loadedAddress)) { pendingNotificationOpen.current = false; webRef.current?.injectJavaScript("if(!location.pathname.startsWith('/home/notifications')) location.assign('/home/notifications');true;"); }
          pushInsets();
          checkBackend();
          void publishReadiness();
        }}
        onContentProcessDidTerminate={() => {
          setFoodCamera(null);
          monitor.current?.stop();
          stopNativeCamera();
          console.log('WebView process terminated');
          setError(true);
        }}
      /> : null}
      {providerSession && <PoseTrackerNative key={`${providerSession.exercise}:${providerSession.pattern}`} {...providerSession} close={closeProviderSession} onSafetyAlarm={poseSafetyAlarm} onSafetyStop={poseSafetyStop} deliveryStatus={poseDeliveryStatus}/>}
      {foodCamera && <FoodScannerCamera key={foodCamera.requestId} request={foodCamera} finish={result => {
        const detail = JSON.stringify({ ...result, requestId: foodCamera.requestId }).replace(/</g, '\\u003c');
        if (result.type !== 'ready') setFoodCamera(null);
        webRef.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('physiquequest-food-camera',{detail:${detail}}));true;`);
      }} />}
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
              webRef.current?.injectJavaScript(buildCameraScript({ type: 'status', status: 'unavailable', generation:cameraPreview.generation, message: String(detail.message), reason: detail.code==='timeout'?'timeout':String(detail.message).includes('too warm')?'thermal':detail.reason==='unsupported'?'no_camera':'interrupted_too_often' }));
            }
          }}
          ready={() => {if(cameraPreview.instanceId===cameraRequestId.current)webRef.current?.injectJavaScript(buildCameraScript({ type: 'status', status: 'on', generation:cameraPreview.generation }));}}
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
            webRef.current?.injectJavaScript(buildCameraScript({ type: 'status', status: 'on', generation:cameraPreview.generation }));
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
              generation:cameraPreview.generation,
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
              Start the web app and backend on your computer. On the same Wi-Fi, enter the computer's
              network address with port 3000. On another network, enter a reachable HTTPS address.
            </Text>
            <Text style={[styles.label, { fontSize: bodySize - 1 }]}>Server address</Text>
            <TextInput
              accessibilityLabel="Server address"
              accessibilityHint="Enter your computer's network address or a reachable HTTPS server URL"
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
              The app uses this address for both the website and its /api backend. If the temporary tunnel
              address changes, tap Change server and enter the new HTTPS address.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

export default function App() {
  const [showUpdate, setShowUpdate] = useState(false);
  const updateRequested = useRef(false);
  const onAuthenticated = useCallback(() => {
    if (updateRequested.current) return;
    updateRequested.current = true;
    void SecureStore.getItemAsync('pq_update_notice_1_5_0').then(value => {
      if (value !== 'seen') setShowUpdate(true);
    }).catch(() => setShowUpdate(true));
  }, []);
  const dismissUpdate = () => {
    setShowUpdate(false);
    void SecureStore.setItemAsync('pq_update_notice_1_5_0', 'seen').catch(() => {});
  };
  return (
    <SafeAreaProvider>
      <AppContent onAuthenticated={onAuthenticated} />
      <Modal visible={showUpdate} transparent animationType="fade" onRequestClose={dismissUpdate}>
        <View style={styles.updateBackdrop} accessibilityViewIsModal>
          <View style={styles.updateCard}>
            <ScrollView contentContainerStyle={styles.updateContent}>
              <Text style={styles.updateVersion}>VERSION 1.5.0</Text>
              <Text accessibilityRole="header" style={styles.updateTitle}>What's new in this update?</Text>
              <Text style={styles.updateItem}>• Open saved account data while the service reconnects, when an offline session is available.</Text>
              <Text style={styles.updateItem}>• The app includes your familiar workout screens again.</Text>
              <Text style={styles.updateItem}>• The camera can detect when its picture stops updating and try to recover.</Text>
              <Text style={styles.updateItem}>• Exercise guidance focuses on keeping the joints used for your movement in view.</Text>
              <Text style={styles.updateItem}>• The tracker checks how clearly a joint is detected before starting an exercise.</Text>
              <Text style={styles.updateItem}>• Use the front or back camera to suit your workout setup.</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close update notice" onPress={dismissUpdate} style={styles.updateButton}>
                <Text style={styles.buttonText}>Got it</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  updateBackdrop: { flex: 1, backgroundColor: '#000b', justifyContent: 'center', padding: 20 },
  updateCard: { backgroundColor: '#161d27', borderRadius: 22, borderWidth: 1, borderColor: '#273444', maxHeight: '85%' },
  updateContent: { padding: 24, gap: 14 },
  updateVersion: { color: '#22c55e', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  updateTitle: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  updateItem: { color: '#cbd5e1', fontSize: 16, lineHeight: 24 },
  updateButton: { minHeight: 50, marginTop: 8, borderRadius: 14, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' },
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
