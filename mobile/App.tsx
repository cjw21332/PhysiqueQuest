import Constants from 'expo-constants';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

declare const process: { env: { EXPO_PUBLIC_WEB_APP_URL?: string } };

function getInitialAddress() {
  const configured = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:3000` : 'http://192.168.100.5:3000';
}

/**
 * Publishes the native safe-area insets (status bar, Android gesture/nav bar,
 * display cutouts) to the web document as CSS custom properties so the web app
 * can pad its content clear of the system UI.
 */
function buildInsetsScript(insets: { top: number; bottom: number; left: number; right: number }) {
  const { top, bottom, left, right } = insets;
  return `(function(){try{
    var r=document.documentElement.style;
    r.setProperty('--safe-top','${top}px');
    r.setProperty('--safe-bottom','${bottom}px');
    r.setProperty('--safe-left','${left}px');
    r.setProperty('--safe-right','${right}px');
    var m=document.createElement('meta');
    m.name='viewport';
    m.content='width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover';
    document.head.appendChild(m);
  }catch(e){}})();true;`;
}

function buildBackendCheckScript() {
  return `(function(){fetch(window.location.protocol+'//'+window.location.hostname+':4000/api',{credentials:'include'}).then(function(r){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'backend-status',ok:r.ok,status:r.status}));}).catch(function(){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'backend-status',ok:false}));});})();true;`;
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const { width } = useWindowDimensions();
  const inferredAddress = useMemo(getInitialAddress, []);
  const [address, setAddress] = useState(inferredAddress);
  const [loadedAddress, setLoadedAddress] = useState(inferredAddress);
  const [error, setError] = useState(!inferredAddress);
  const [key, setKey] = useState(0);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const insetScript = useMemo(
    () => buildInsetsScript({ top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right }),
    [insets.top, insets.bottom, insets.left, insets.right],
  );

  const pushInsets = useCallback(() => {
    webRef.current?.injectJavaScript(insetScript);
  }, [insetScript]);

  const checkBackend = useCallback(() => {
    setBackendStatus('checking');
    webRef.current?.injectJavaScript(buildBackendCheckScript());
  }, []);

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

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      {loadedAddress ? <WebView
        ref={webRef}
        key={key}
        source={{ uri: loadedAddress }}
        style={StyleSheet.absoluteFill}
        containerStyle={styles.webContainer}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={insetScript}
        javaScriptEnabled
        domStorageEnabled
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState
        bounces={false}
        overScrollMode="never"
        scrollEnabled
        cacheEnabled={false}
        incognito={false}
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        scalesPageToFit={false}
        textZoom={100}
        renderLoading={() => (
          <View style={[styles.loading, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
            <ActivityIndicator size="large" color="#26743a" />
            <Text style={[styles.loadingText, { fontSize: bodySize }]}>Opening PhysiqueQuest…</Text>
          </View>
        )}
        onError={(e) => {
          console.error('WebView error:', e.nativeEvent);
          setError(true);
        }}
        onHttpError={e => {
          console.error('HTTP error:', e.nativeEvent);
          if (e.nativeEvent.statusCode >= 500) setError(true);
        }}
        onMessage={(e) => {
          try {
            const message = JSON.parse(e.nativeEvent.data) as { type?: string; ok?: boolean };
            if (message.type === 'backend-status') setBackendStatus(message.ok ? 'online' : 'offline');
          } catch { console.log('WebView message:', e.nativeEvent.data); }
        }}
        onLoadStart={() => {
          console.log('WebView load started:', loadedAddress);
        }}
        onLoadEnd={(e) => {
          console.log('WebView load ended:', e.nativeEvent.url);
          pushInsets();
          checkBackend();
        }}
        onContentProcessDidTerminate={() => {
          console.error('WebView process terminated');
          setError(true);
        }}
      /> : null}
      {loadedAddress && !error && backendStatus === 'offline' && (
        <View style={[styles.backendBanner, { top: insets.top + 8, left: insets.left + 12, right: insets.right + 12 }]}>
          <Text style={styles.backendBannerText}>Backend unavailable · server-backed features cannot sync</Text>
          <Pressable accessibilityRole="button" onPress={checkBackend}><Text style={styles.retryText}>Retry backend check</Text></Pressable>
        </View>
      )}
      {error && (
        <View
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
        </View>
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
  root: { flex: 1, backgroundColor: '#f4f6f3' },
  webContainer: { flex: 1, backgroundColor: '#f4f6f3' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f4f6f3',
  },
  loadingText: { color: '#536176', textAlign: 'center' },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f6f3',
  },
  errorCard: { width: '100%', backgroundColor: '#fff' },
  title: { marginBottom: 10, color: '#192233', fontWeight: '700' },
  body: { color: '#536176' },
  code: { color: '#192233', fontWeight: '700' },
  label: { marginTop: 20, marginBottom: 6, color: '#192233', fontWeight: '600' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce4dc',
    color: '#192233',
  },
  button: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#7ee582',
  },
  buttonText: { color: '#173c1f', fontWeight: '700' },
  hint: { marginTop: 12, color: '#718096' },
  backendBanner: {
    position: 'absolute',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#fff4d6',
    borderWidth: 1,
    borderColor: '#f0d28a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  backendBannerText: { flex: 1, color: '#624b16', fontSize: 12, fontWeight: '600' },
  retryText: { color: '#26743a', fontSize: 12, fontWeight: '700' },
});
