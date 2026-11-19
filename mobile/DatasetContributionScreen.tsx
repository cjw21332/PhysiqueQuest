import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CAMERA_PLACEMENTS, placementGuidance } from './datasetContribution.mjs';

export type ContributionExercise = { id: string; name: string; pattern: string };
export type ConsentDocument = { version: string; text: string; textHash: string; state: { contributable: boolean; reason?: string } };

type Props = {
  consent: ConsentDocument | null;
  exercises: ContributionExercise[];
  busy?: boolean;
  quality?: { ok: boolean; reason?: string; detectionRate?: number } | null;
  onAcceptConsent: () => void;
  onWithdrawConsent: () => void;
  onStart: (selection: { exercise: ContributionExercise; placement: string; facing: 'front' | 'back' }) => void;
  onStop: () => void;
  onSubmit: (declaredReps: number | null) => void;
  onClose: () => void;
};

/**
 * Presentational contribution flow. Deliberately does not own a camera: the
 * caller records frames through the same native capture path as PoseTracker and
 * passes them to datasetContribution.js. Nothing here runs unless the user
 * pressed an explicit "contribute" entry point outside their normal session.
 */
export default function DatasetContributionScreen({
  consent,
  exercises,
  busy,
  quality,
  onAcceptConsent,
  onWithdrawConsent,
  onStart,
  onStop,
  onSubmit,
  onClose,
}: Props) {
  const [exercise, setExercise] = useState<ContributionExercise | null>(null);
  const [placement, setPlacement] = useState('diagonal');
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [recording, setRecording] = useState(false);
  const [reps, setReps] = useState('');
  const accepted = consent?.state.contributable === true;

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">Contribute a recording to research</Text>
      <Text style={styles.muted}>
        Optional. Separate from camera permission and never applied to your normal PoseTracker sessions.
      </Text>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.section}>1. Consent</Text>
        {!consent && <Text style={styles.muted}>Loading consent text…</Text>}
        {consent && (
          <>
            <Text style={styles.consent} accessibilityLabel="Consent text">{consent.text}</Text>
            <Text style={styles.muted}>Version {consent.version}</Text>
            {accepted ? (
              <Pressable style={[styles.button, styles.secondary]} onPress={onWithdrawConsent} disabled={busy} accessibilityRole="button">
                <Text style={styles.buttonText}>Withdraw and delete my contributed clips</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.button} onPress={onAcceptConsent} disabled={busy} accessibilityRole="button">
                <Text style={styles.buttonText}>I agree — contribute keypoints only</Text>
              </Pressable>
            )}
          </>
        )}

        <Text style={styles.section}>2. Pick the exercise before you record</Text>
        <View style={styles.chips}>
          {exercises.map(item => (
            <Pressable
              key={item.id}
              onPress={() => setExercise(item)}
              disabled={!accepted || busy || recording}
              accessibilityRole="radio"
              accessibilityState={{ selected: exercise?.id === item.id }}
              style={[styles.chip, exercise?.id === item.id && styles.chipSelected]}
            >
              <Text style={styles.chipText}>{item.name}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>3. Place the phone</Text>
        <View style={styles.chips}>
          {CAMERA_PLACEMENTS.map(item => (
            <Pressable
              key={item.id}
              onPress={() => setPlacement(item.id)}
              disabled={!accepted || busy || recording}
              accessibilityRole="radio"
              accessibilityState={{ selected: placement === item.id }}
              style={[styles.chip, placement === item.id && styles.chipSelected]}
            >
              <Text style={styles.chipText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.muted}>{placementGuidance(placement)}</Text>
        <Text style={styles.muted}>Stand so your whole body is in frame, use even lighting, and face away from windows.</Text>

        <Text style={styles.section}>4. Record</Text>
        <View style={styles.chips}>
          {(['back', 'front'] as const).map(value => (
            <Pressable
              key={value}
              onPress={() => setFacing(value)}
              disabled={!accepted || busy || recording}
              accessibilityRole="radio"
              accessibilityState={{ selected: facing === value }}
              style={[styles.chip, facing === value && styles.chipSelected]}
            >
              <Text style={styles.chipText}>{value === 'back' ? 'Rear camera' : 'Front camera'}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.button, (!accepted || !exercise) && styles.disabled]}
          disabled={!accepted || !exercise || busy || recording}
          onPress={() => { setRecording(true); if (exercise) onStart({ exercise, placement, facing }); }}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Start recording</Text>
        </Pressable>
        {recording && (
          <Pressable style={[styles.button, styles.secondary]} onPress={() => { setRecording(false); onStop(); }} accessibilityRole="button">
            <Text style={styles.buttonText}>Stop and review</Text>
          </Pressable>
        )}
        {quality && (
          <Text style={[styles.muted, !quality.ok && styles.warning]}>
            {quality.ok
              ? `Quality check passed · ${Math.round((quality.detectionRate ?? 0) * 100)}% of frames tracked`
              : `Not usable yet: ${quality.reason ?? 'retry the recording'}`}
          </Text>
        )}

        <Text style={styles.section}>5. Submit</Text>
        <Text style={styles.muted}>Only the keypoints, your exercise choice and the recording metadata are uploaded. No video or images.</Text>
        <Text style={styles.input}>
          Reps performed (optional): {reps || '—'}
        </Text>
        <View style={styles.chips}>
          {['', '5', '10', '15', '20'].map(value => (
            <Pressable key={value || 'none'} onPress={() => setReps(value)} style={[styles.chip, reps === value && styles.chipSelected]} accessibilityRole="radio" accessibilityState={{ selected: reps === value }}>
              <Text style={styles.chipText}>{value || 'Skip'}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.button, (!accepted || !exercise || recording) && styles.disabled]}
          disabled={!accepted || !exercise || recording || busy}
          onPress={() => onSubmit(reps ? Number(reps) : null)}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Contribute this recording</Text>
        </Pressable>
      </ScrollView>

      <Pressable style={styles.close} onPress={onClose} accessibilityRole="button">
        <Text style={styles.buttonText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 60, elevation: 60, backgroundColor: '#0b0f15', padding: 16, gap: 8 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  section: { color: '#65dcbc', fontSize: 15, fontWeight: '700', marginTop: 14 },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 24, gap: 6 },
  muted: { color: '#c6e5dc', fontSize: 12 },
  warning: { color: '#ffd84c' },
  consent: { color: '#e6f4f0', fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { borderWidth: 1, borderColor: '#3b4a52', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipSelected: { borderColor: '#65dcbc', backgroundColor: '#11312a' },
  chipText: { color: '#fff', fontSize: 12 },
  button: { backgroundColor: '#22c55e', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10 },
  secondary: { backgroundColor: '#31424b' },
  disabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '700' },
  close: { backgroundColor: '#31424b', borderRadius: 12, padding: 12, alignItems: 'center' },
  input: { color: '#fff', fontSize: 13, marginTop: 6 },
});
