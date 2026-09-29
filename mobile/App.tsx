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
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

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
        <StatusBar barStyle="dark-content" backgroundColor="#f4f6f3" />
        <WebView
          key={key}
          source={{ uri: loadedAddress }}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          allowsBackForwardNavigationGestures
          startInLoadingState
          renderLoading={() => <View style={styles.loading}><ActivityIndicator size="large" color="#26743a"/><Text style={styles.loadingText}>Opening PhysiqueQuest…</Text></View>}
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6f3' },
  webView: { flex: 1, backgroundColor: '#f4f6f3' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f4f6f3' },
  loadingText: { color: '#536176', fontSize: 14 },
  errorOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f4f6f3' },
  errorCard: { width: '100%', maxWidth: 420, padding: 22, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e9e3' },
  title: { marginBottom: 9, color: '#192233', fontSize: 21, fontWeight: '700' },
  body: { color: '#536176', fontSize: 14, lineHeight: 21 },
  code: { color: '#192233', fontWeight: '700' },
  label: { marginTop: 19, marginBottom: 6, color: '#192233', fontSize: 13, fontWeight: '600' },
  input: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#dce4dc', color: '#192233', fontSize: 14 },
  button: { minHeight: 46, marginTop: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#7ee582' },
  buttonText: { color: '#173c1f', fontSize: 14, fontWeight: '700' },
  hint: { marginTop: 11, color: '#718096', fontSize: 12, lineHeight: 18 },
});
