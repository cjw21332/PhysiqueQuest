export type GoogleAuthIntent = 'login' | 'register';

type GoogleAuthResult = {
  requestId: string;
  idToken?: string;
  error?: string;
  cancelled?: boolean;
};

type PromptNotification = {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
};

type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback(response: { credential?: string }): void }): void;
      prompt(callback?: (notification: PromptNotification) => void): void;
    };
  };
};

type GoogleWindow = Window & {
  google?: GoogleIdentityApi;
  ReactNativeWebView?: { postMessage(message: string): void };
};

const GOOGLE_WEB_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  || '390685281626-3g9bucvvl5t3sfjg3e6tj0gvaupsdcl5.apps.googleusercontent.com';
const GOOGLE_RESULT_EVENT = 'physiquequest-google-auth-result';
let googleScript: Promise<GoogleIdentityApi> | null = null;
let requestSequence = 0;

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `google-${Date.now()}-${++requestSequence}`;
}

function loadGoogleIdentityApi(): Promise<GoogleIdentityApi> {
  const googleWindow = window as GoogleWindow;
  if (googleWindow.google?.accounts?.id) return Promise.resolve(googleWindow.google);
  if (googleScript) return googleScript;

  const loading = new Promise<GoogleIdentityApi>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => reject(new Error('Google sign-in could not be loaded. Check your connection and try again.')), 10_000);
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.clearTimeout(timeout);
      if (googleWindow.google?.accounts?.id) resolve(googleWindow.google);
      else reject(new Error('Google sign-in could not be initialized. Please try again.'));
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error('Google sign-in could not be loaded. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  const tracked = loading.catch(error => {
    googleScript = null;
    throw error;
  });
  googleScript = tracked;
  return tracked;
}

function requestNativeGoogleIdentity(intent: GoogleAuthIntent, bridge: NonNullable<GoogleWindow['ReactNativeWebView']>) {
  const requestId = createRequestId();
  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Google sign-in timed out. Please try again.'));
    }, 120_000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener(GOOGLE_RESULT_EVENT, receive);
    };
    const receive = (event: Event) => {
      const result = (event as CustomEvent<GoogleAuthResult>).detail;
      if (!result || result.requestId !== requestId) return;
      cleanup();
      if (result.idToken) resolve(result.idToken);
      else if (result.cancelled) reject(new Error('Google sign-in was cancelled.'));
      else reject(new Error(result.error || 'Google sign-in could not be completed. Please try again.'));
    };

    window.addEventListener(GOOGLE_RESULT_EVENT, receive);
    try {
      bridge.postMessage(JSON.stringify({ type: 'google-sign-in', requestId, intent }));
    } catch {
      cleanup();
      reject(new Error('Google sign-in could not be started. Please try again.'));
    }
  });
}

async function requestBrowserGoogleIdentity(): Promise<string> {
  const google = await loadGoogleIdentityApi();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      action();
    };
    const timeout = window.setTimeout(() => finish(() => reject(new Error('Google sign-in timed out. Please try again.'))), 60_000);

    google.accounts.id.initialize({
      client_id: GOOGLE_WEB_CLIENT_ID,
      callback: response => {
        if (typeof response.credential === 'string' && response.credential.length) {
          finish(() => resolve(response.credential!));
        } else {
          finish(() => reject(new Error('Google did not return an identity token. Please try again.')));
        }
      },
    });
    google.accounts.id.prompt(notification => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
        finish(() => reject(new Error('Google sign-in was closed. Please try again.')));
      }
    });
  });
}

export function requestGoogleIdentity(intent: GoogleAuthIntent): Promise<string> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google sign-in is only available in the app or browser.'));
  const bridge = (window as GoogleWindow).ReactNativeWebView;
  return bridge ? requestNativeGoogleIdentity(intent, bridge) : requestBrowserGoogleIdentity();
}
