import Constants from 'expo-constants';
import { useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

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
  return host ? `http://${host}:3000` : 'http://localhost:3000';
}

export default function App() {
  const inferredAddress = useMemo(getInitialAddress, []);
  const [address, setAddress] = useState(inferredAddress);
  const [loadedAddress, setLoadedAddress] = useState(inferredAddress);
  const [error, setError] = useState(false);
  const [key, setKey] = useState(0);
  const dark = useColorScheme() === 'dark';
  const theme = dark ? palettes.dark : palettes.light;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const connect = () => {
    const normalized = address.trim().replace(/\/$/, '');
    const withProtocol = /^https?:\/\//i.test(normalized) ? normalized : `http://${normalized}`;
    setAddress(withProtocol);
    setLoadedAddress(withProtocol);
    setError(false);
    setKey(current => current + 1);
    Keyboard.dismiss();
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
        <WebView
          key={key}
          source={{ uri: loadedAddress }}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          allowsBackForwardNavigationGestures
          startInLoadingState
          renderLoading={() => <View style={styles.loading}><ActivityIndicator size="large" color={theme.spinner}/><Text style={styles.loadingText}>Opening PhysiqueQuest…</Text></View>}
          onError={() => setError(true)}
          onHttpError={event => { if (event.nativeEvent.statusCode >= 500) setError(true); }}
        />
        {error && (
          <View style={styles.errorOverlay}>
            <View style={styles.errorCard}>
              <Text style={styles.title}>Can’t reach PhysiqueQuest</Text>
              <Text style={styles.body}>Start the web app on your computer with <Text style={styles.code}>npm run dev</Text>. Keep your phone and computer on the same Wi-Fi network.</Text>
              <Text style={styles.label}>Computer address</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onChangeText={setAddress}
                onSubmitEditing={connect}
                placeholder="http://192.168.1.10:3000"
                returnKeyType="go"
                style={styles.input}
                value={address}
              />
              <Pressable accessibilityRole="button" onPress={connect} style={styles.button}>
                <Text style={styles.buttonText}>Connect</Text>
              </Pressable>
              <Text style={styles.hint}>The computer address is usually printed beside “Network” when Next.js starts.</Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const makeStyles = (c: typeof palettes.light) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.background },
  webView: { flex: 1, backgroundColor: c.background },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: c.background },
  loadingText: { color: c.muted, fontSize: 14 },
  errorOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: c.background },
  errorCard: { width: '100%', maxWidth: 420, padding: 22, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder },
  title: { marginBottom: 9, color: c.ink, fontSize: 21, fontWeight: '700' },
  body: { color: c.muted, fontSize: 14, lineHeight: 21 },
  code: { color: c.ink, fontWeight: '700' },
  label: { marginTop: 19, marginBottom: 6, color: c.ink, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: c.inputBorder, color: c.ink, fontSize: 14 },
  button: { minHeight: 46, marginTop: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: c.green },
  buttonText: { color: c.greenInk, fontSize: 14, fontWeight: '700' },
  hint: { marginTop: 11, color: c.hint, fontSize: 12, lineHeight: 18 },
});
