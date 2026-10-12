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
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
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
  }
}

export function createNativeMonitor({ onEvent }: Callbacks) {
  let machine: ReturnType<typeof createInactivityMachine> | null = null;
  let detector = createMovementDetector();
  let sensorSub: { remove: () => void } | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  const flush = () => {
    if (!machine) return;
    for (const event of machine.drain()) {
      if (event.type === 'alarm') {
        // Location is captured while the app is in the foreground, then the alarm is reported with it.
        void captureLocation().then(location => onEvent({ type: 'alarm', location }));
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
      stopSensor();
      machine = createInactivityMachine({ thresholdMs });
      detector = createMovementDetector();
      machine.start(Date.now());
      await activateKeepAwakeAsync();

      const available = await Accelerometer.isAvailableAsync();
      onEvent({ type: 'motion-status', available });
      if (!available) return;

      Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
      sensorSub = Accelerometer.addListener(sample => {
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
      stopSensor();
      if (tickTimer) clearInterval(tickTimer);
      tickTimer = null;
      machine = null;
      deactivateKeepAwake();
    },
  };
}
