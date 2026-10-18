import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { createInactivityMachine } from './inactivityMachine.mjs';
import { createMovementDetector } from './movement.mjs';

/** Location capture gives up after this long and the alert goes out without coordinates. */
const LOCATION_TIMEOUT_MS = 5000;
const SAMPLE_INTERVAL_MS = 100;
const TICK_INTERVAL_MS = 1000;

export type LocationFix = { lat: number; lng: number; accuracyMeters: number; capturedAt: string };

type Callbacks = {
  /** Sent to the WebView as a `physiquequest-inactivity` event. */
  onEvent: (detail: Record<string, unknown>) => void;
};

/** Returns a fix within the timeout, or null when permission is denied or the fix is too slow. */
export async function captureLocation(): Promise<LocationFix | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>(resolve => { timeout = setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS); }),
    ]);
    if (!fix) return null;
    return {
      lat: fix.coords.latitude,
      lng: fix.coords.longitude,
      accuracyMeters: fix.coords.accuracy ?? 0,
      capturedAt: new Date(fix.timestamp).toISOString(),
    };
  } catch {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function createNativeMonitor({ onEvent }: Callbacks) {
  let generation = 0;
  let awakeTag: string | null = null;
  let machine: ReturnType<typeof createInactivityMachine> | null = null;
  let detector = createMovementDetector();
  let sensorSub: { remove: () => void } | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  const flush = () => {
    if (!machine) return;
    for (const event of machine.drain()) {
      if (event.type === 'alarm') {
        // Location is captured while the app is in the foreground, then the alarm is reported with it.
        const run = generation;
        void captureLocation().then(location => { if (run === generation && machine) onEvent({ type: 'alarm', location }); });
      } else {
        onEvent(event);
      }
    }
  };

  const stopSensor = () => {
    sensorSub?.remove();
    sensorSub = null;
  };

  return {
    async start(thresholdMs: number) {
      const run = ++generation;
      stopSensor();
      if (tickTimer) clearInterval(tickTimer);
      tickTimer = null;
      if (awakeTag) deactivateKeepAwake(awakeTag);
      const tag = `physiquequest-monitor:${run}`;
      awakeTag = tag;
      machine = createInactivityMachine({ thresholdMs });
      detector = createMovementDetector();
      machine.start(Date.now());
      await activateKeepAwakeAsync(tag).catch(() => undefined);
      if (run !== generation) { deactivateKeepAwake(tag); return; }

      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      if (run !== generation) { deactivateKeepAwake(tag); return; }
      onEvent({ type: 'motion-status', available });
      if (!available) { deactivateKeepAwake(tag); return; }

      Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
      sensorSub = Accelerometer.addListener(sample => {
        if (run !== generation) return;
        if (detector.sample(sample)) machine?.movement(Date.now());
      });
      tickTimer = setInterval(() => {
        machine?.tick(Date.now());
        flush();
      }, TICK_INTERVAL_MS);
    },

    /** Reports sensor availability without starting the monitor or keep-awake. */
    async reportMotionStatus() {
      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      onEvent({ type: 'motion-status', available });
    },

    imOkay() {
      machine?.imOkay(Date.now());
      flush();
    },

    holdStop() {
      machine?.holdStop();
      flush();
      onEvent({ type: 'stopped' });
    },

    stop() {
      generation++;
      stopSensor();
      if (tickTimer) clearInterval(tickTimer);
      tickTimer = null;
      machine = null;
      if (awakeTag) deactivateKeepAwake(awakeTag);
      awakeTag = null;
    },
  };
}
