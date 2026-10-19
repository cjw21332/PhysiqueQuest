import { requireOptionalNativeModule } from 'expo';

type EmergencyAlarmModule = {
  start(): boolean;
  stop(): void;
};

// Custom native code is available in Android development/production builds.
// Expo Go and iOS retain the WebView sound at the device's available volume.
const nativeAlarm = requireOptionalNativeModule<EmergencyAlarmModule>('EmergencyAlarm');

export function startNativeAlarm(): boolean {
  try {
    return nativeAlarm?.start() ?? false;
  } catch (error) {
    console.warn('Native emergency sound unavailable; using browser audio.', error);
    return false;
  }
}

export function stopNativeAlarm(): void {
  try {
    nativeAlarm?.stop();
  } catch (error) {
    console.warn('Could not stop the native emergency sound.', error);
  }
}
