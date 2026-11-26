import { createRequestKey } from './requestKey';
import type { NativeRefresh } from './rotatingSession.mjs';
export type OfflineAccount = {id:string;expiresAt:number};
export function nativeOfflineAccount(type:string,token?:string):Promise<OfflineAccount | null> {
  if (typeof window === 'undefined' || !window.ReactNativeWebView) return Promise.resolve(null);
  const requestId = createRequestKey();
  return new Promise(resolve => {
    const finish = (value:OfflineAccount | null) => {
      clearTimeout(timer);
      window.removeEventListener('physiquequest:offline-account',receive);
      resolve(value);
    };
    const receive = (event:Event) => {
      const reply = (event as CustomEvent).detail;
      if (reply?.requestId === requestId) finish(reply.account ?? null);
    };
    const timer = setTimeout(()=>finish(null),10000);
    window.addEventListener('physiquequest:offline-account',receive);
    window.ReactNativeWebView!.postMessage(JSON.stringify({type,requestId,token}));
  });
}

/**
 * Refreshes the login through the app shell's secure-store device session. Resolves null outside the
 * app or in shells without device sessions, so callers fall back to the refresh cookie.
 */
export function nativeDeviceRefresh(): Promise<NativeRefresh | null> {
  if (typeof window === 'undefined' || !window.ReactNativeWebView || !(window as Window & { __pqDeviceSessions?: number }).__pqDeviceSessions) return Promise.resolve(null);
  const requestId = createRequestKey();
  return new Promise(resolve => {
    const finish = (value: NativeRefresh) => { clearTimeout(timer); window.removeEventListener('physiquequest:device-session', receive); resolve(value); };
    const receive = (event: Event) => {
      const reply = (event as CustomEvent).detail;
      if (reply?.requestId !== requestId) return;
      finish(reply.status === 'ok' && reply.session ? { status: 'ok', session: reply.session } : { status: ['none', 'unauthorized'].includes(reply.status) ? reply.status : 'error' });
    };
    // A sleeping hosted API can take ~40 s to answer; the shell's own request times out at 20 s.
    const timer = setTimeout(() => finish({ status: 'error' }), 25_000);
    window.addEventListener('physiquequest:device-session', receive);
    window.ReactNativeWebView!.postMessage(JSON.stringify({ type: 'refresh-device-session', requestId }));
  });
}
