import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

type Delivery = 'idle' | 'pending' | 'delivered' | 'failed';
const HOLD_MS = 3000;

function AlarmIcon({ type, size = 20, color = '#fff' }: { type: 'bell' | 'check' | 'clock' | 'warning'; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    {type === 'bell' ? <><Path d="M18 8a6 6 0 0 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9M10 20a2 2 0 0 0 4 0"/><Path d="M3 9a9 9 0 0 1 2-5M21 9a9 9 0 0 0-2-5"/></> : type === 'check' ? <Path d="m5 12 4 4L19 6"/> : type === 'clock' ? <><Circle cx="12" cy="12" r="9"/><Path d="M12 7v5l3 2"/></> : <><Circle cx="12" cy="12" r="9"/><Path d="M12 7v6M12 17h.01"/></>}
  </Svg>;
}

export default function PoseAlarmScreen({ exercise, contactName, deliveryStatus, alarmSound, onStop }: { exercise: string; contactName?: string; deliveryStatus: Delivery; alarmSound: boolean; onStop: () => void }) {
  const insets = useSafeAreaInsets();
  const [recordedAt] = useState(() => new Date());
  const [progress, setProgress] = useState(0);
  const holdStart = useRef<number | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const completed = useRef(false);
  const clearHold = () => {
    if (holdInterval.current) clearInterval(holdInterval.current);
    holdInterval.current = null;
    holdStart.current = null;
    setProgress(0);
  };
  useEffect(() => () => { if (holdInterval.current) clearInterval(holdInterval.current); }, []);
  const beginHold = () => {
    if (holdInterval.current || completed.current) return;
    holdStart.current = performance.now();
    holdInterval.current = setInterval(() => {
      const value = Math.min(1, (performance.now() - (holdStart.current ?? performance.now())) / HOLD_MS);
      setProgress(value);
      if (value >= 1 && !completed.current) {
        completed.current = true;
        if (holdInterval.current) clearInterval(holdInterval.current);
        holdInterval.current = null;
        onStop();
      }
    }, 50);
  };
  const label = deliveryStatus === 'delivered' ? 'Delivered' : deliveryStatus === 'failed' ? 'Not delivered' : 'Sending…';
  const formattedTime = recordedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const formattedDate = recordedAt.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]} accessibilityViewIsModal>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.bellRing}><AlarmIcon type="bell" size={34}/></View>
        <Text style={styles.eyebrow}>{alarmSound ? 'Alarm active · alarm volume' : 'Alarm sound unavailable'}</Text>
        <Text style={styles.title}>Emergency alert</Text>
        <Text style={styles.description}>Movement was not detected during {exercise}. Recorded at {formattedTime}.</Text>
      </View>

      <View style={styles.contactCard} accessibilityLiveRegion="polite">
        <View style={styles.contactHeader}><Text style={styles.cardLabel}>Emergency contact</Text><View style={styles.status}><AlarmIcon type={deliveryStatus === 'delivered' ? 'check' : deliveryStatus === 'failed' ? 'warning' : 'clock'} size={14}/><Text style={styles.statusText}>{label}</Text></View></View>
        <Text style={styles.contactTitle}>{contactName || 'Emergency contact'}</Text>
        <Text style={styles.contactDetail}>{deliveryStatus === 'delivered' ? 'Notification confirmed' : deliveryStatus === 'failed' ? 'Notification not confirmed' : 'Notification in progress'} · No location shared</Text>
      </View>

      {!alarmSound && <View style={styles.error} accessibilityRole="alert"><AlarmIcon type="warning" size={18} color="#ff9ba0"/><Text style={styles.errorText}>The phone could not start the alarm sound.</Text></View>}

      <Pressable accessibilityRole="button" accessibilityLabel="Hold for three seconds to stop the alarm and end the session" accessibilityHint="Keep holding until the alarm stops. Screen reader users can activate the stop action." accessibilityActions={[{ name: 'activate', label: 'Start stopping the alarm' }]} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate') beginHold(); }} style={styles.holdButton} onPressIn={beginHold} onPressOut={clearHold}>
        <View pointerEvents="none" style={[styles.holdFill, { width: `${progress * 100}%` }]}/>
        <Text style={styles.holdText}>{progress > 0 ? 'Keep holding…' : 'Hold to stop alarm'}</Text>
      </Pressable>
      <Text style={styles.hint}>Hold for 3 seconds — prevents accidental dismissal</Text>

      <View style={styles.logCard}>
        <View style={styles.logHeader}><Text style={styles.logTitle}>Session alert</Text><Text style={styles.logCaption}>This session</Text></View>
        <View style={styles.logEntry}><View style={styles.logEntryText}><Text style={styles.logDate}>{formattedDate} · {formattedTime}</Text><Text style={styles.logDetail}>{exercise} · inactivity alert</Text></View><View style={styles.openPill}><Text style={styles.openText}>Open</Text></View></View>
      </View>
      <Text style={styles.disclaimer}>This alert does not confirm a medical emergency.</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, zIndex: 101, elevation: 101, backgroundColor: '#40090b' },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 34, paddingBottom: 24 },
  hero: { alignItems: 'center', paddingHorizontal: 8 },
  bellRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#f4d6d7', fontSize: 12, marginTop: 22 },
  title: { color: '#fff', fontSize: 26, lineHeight: 32, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  description: { color: '#e1c7c9', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  contactCard: { backgroundColor: '#490d10', borderRadius: 14, padding: 14, marginTop: 22, gap: 7 },
  contactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardLabel: { color: '#d9b7b9', fontSize: 12, flexShrink: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#35090b' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  contactTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  contactDetail: { color: '#d9b7b9', fontSize: 12 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  errorText: { color: '#ffb8bc', flex: 1, fontSize: 13 },
  holdButton: { marginTop: 22, minHeight: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: '#141c28', alignItems: 'center', justifyContent: 'center' },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#6d2026' },
  holdText: { color: '#ff737b', fontSize: 16, fontWeight: '800' },
  hint: { color: '#e1babc', fontSize: 12, marginTop: 10, textAlign: 'center' },
  logCard: { backgroundColor: '#141c28', borderRadius: 16, padding: 16, marginTop: 24 },
  logHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  logTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  logCaption: { color: '#95a4ba', fontSize: 12 },
  logEntry: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  logEntryText: { flex: 1 },
  logDate: { color: '#fff', fontSize: 14, fontWeight: '600' },
  logDetail: { color: '#95a4ba', fontSize: 12, lineHeight: 18, marginTop: 4 },
  openPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#510d11' },
  openText: { color: '#ff8288', fontSize: 11 },
  disclaimer: { color: '#d9b7b9', fontSize: 12, textAlign: 'center', marginTop: 18 },
});
