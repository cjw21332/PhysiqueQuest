import { createRequestKey } from './requestKey';
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
