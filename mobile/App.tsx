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
  useColorScheme,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

declare const process: { env: { EXPO_PUBLIC_WEB_APP_URL?: string } };

const palettes = {
  light: {
    background: '#f4f6f3',
    card: '#ffffff',
    cardBorder: '#e2e9e3',
    inputBorder: '#dce4dc',
    ink: '#192233',
    muted: '#536176',
    hint: '#718096',
    green: '#7ee582',
    greenInk: '#173c1f',
    spinner: '#26743a',
  },
  dark: {
    background: '#070a0e',
    card: '#10161f',
    cardBorder: '#232f3c',
    inputBorder: '#2a3846',
    ink: '#e9eef4',
    muted: '#a3b1c2',
    hint: '#8d9bad',
    green: '#4cc063',
    greenInk: '#06170d',
    spinner: '#7fd98c',
  },
};

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

function AppContent() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const { width } = useWindowDimensions();
  const inferredAddress = useMemo(getInitialAddress, []);
  const [address, setAddress] = useState(inferredAddress);
  const [loadedAddress, setLoadedAddress] = useState(inferredAddress);
  const [error, setError] = useState(false);
  const [key, setKey] = useState(0);
  const dark = useColorScheme() === 'dark';
  const theme = dark ? palettes.dark : palettes.light;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const insetScript = useMemo(
    () => buildInsetsScript({ top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right }),
    [insets.top, insets.bottom, insets.left, insets.right],
  );

  const pushInsets = useCallback(() => {
    webRef.current?.injectJavaScript(insetScript);
  }, [insetScript]);

  const connect = () => {
    const normalized = address.trim().replace(/\/$/, '');
    const withProtocol = /^https?:\/\//i.test(normalized) ? normalized : `http://${normalized}`;
    setAddress(withProtocol);
    setLoadedAddress(withProtocol);
    setError(false);
    setKey(c => c + 1);
    Keyboard.dismiss();
  };

  const pad = Math.max(16, Math.min(40, Math.round(width * 0.05)));
  const cardMax = Math.min(width - pad * 2, 560);
  const cardPad = Math.max(22, Math.min(38, Math.round(width * 0.07)));
  const bodySize = Math.max(15, Math.min(18, Math.round(width / 24)));

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle={dark ? 'light-content' : 'dark-content'} />
      <WebView
        ref={webRef}
        key={key}
        source={{ uri: loadedAddress }}
        style={StyleSheet.absoluteFill}
        containerStyle={styles.webContainer}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={insetScript}
        onLoadEnd={pushInsets}
        javaScriptEnabled
        domStorageEnabled
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState
        bounces={false}
        overScrollMode="never"
        scrollEnabled
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        scalesPageToFit={false}
        textZoom={100}
        renderLoading={() => (
          <View style={[styles.loading, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
            <ActivityIndicator size="large" color={theme.spinner} />
            <Text style={[styles.loadingText, { fontSize: bodySize }]}>Opening PhysiqueQuest…</Text>
          </View>
        )}
        onError={() => setError(true)}
        onHttpError={e => {
          if (e.nativeEvent.statusCode >= 500) setError(true);
        }}
      />
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
              Start the web app on your computer with <Text style={styles.code}>npm run dev</Text>. Keep
              your phone and computer on the same Wi-Fi network.
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

const makeStyles = (c: typeof palettes.light) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  webContainer: { flex: 1, backgroundColor: c.background },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: c.background,
  },
  loadingText: { color: c.muted, textAlign: 'center' },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
  },
  errorCard: { width: '100%', backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.cardBorder },
  title: { marginBottom: 10, color: c.ink, fontWeight: '700' },
  body: { color: c.muted },
  code: { color: c.ink, fontWeight: '700' },
  label: { marginTop: 20, marginBottom: 6, color: c.ink, fontWeight: '600' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.inputBorder,
    color: c.ink,
  },
  button: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: c.green,
  },
  buttonText: { color: c.greenInk, fontWeight: '700' },
  hint: { marginTop: 12, color: c.hint },
});
