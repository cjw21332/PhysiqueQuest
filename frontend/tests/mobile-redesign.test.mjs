import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('progress displays saved measurement history and honest empty states', async () => {
  const file = await source('sections/Home/Progress.tsx');
  assert.match(file, /useProgress/);
  assert.match(file, /Save measurement/);
  assert.match(file, /No measurements yet/);
  assert.doesNotMatch(file, /const series|68\.5|Personal records|Recent sessions/);
});

test('notifications render authenticated API data instead of sample events', async () => {
  const file = await source('sections/Home/Notifications.tsx');
  assert.match(file, /useNotifications/);
  assert.match(file, /markAllRead/);
  assert.match(file, /Try again/);
  assert.doesNotMatch(file, /const initial =/);
  assert.doesNotMatch(file, /Maria Dela Cruz/);
});

test('Me keeps persistence and root navigation', async () => {
  const file = await source('sections/Me Section/MeSection.tsx');
  assert.match(file, /useSettings/);
  assert.doesNotMatch(file, /localStorage\.getItem\('physiquequest-me-settings'\)/);
  assert.doesNotMatch(file, /localStorage\.setItem\('physiquequest-me-settings'/);
  assert.match(file, /<BottomNav \/>/);
});

test('launch actions use WebView-safe document navigation', async () => {
  const file = await source('app/launch/page.tsx');
  assert.match(file, /<a className="primary" href="\/register">/);
  assert.match(file, /<a className="secondary" href="\/login">/);
  assert.doesNotMatch(file, /router\.push\('\/(?:register|login)'\)/);
});

test('nutrition and settings screens use server-backed state', async () => {
  const scan = await source('sections/Scan/ScanSection.tsx');
  const me = await source('sections/Me Section/MeSection.tsx');
  assert.match(scan, /useNutrition/);
  assert.doesNotMatch(scan, /useState<FoodEntry\[\]>\(sampleMeals\)/);
  assert.match(me, /useSettings/);
  assert.doesNotMatch(me, /localStorage\.getItem\('physiquequest-me-settings'\)/);
});

test('quests and notifications use server-backed state', async () => {
  const quests = await source('sections/Quests Section/QuestSection.tsx');
  const notifications = await source('sections/Home/Notifications.tsx');
  assert.match(quests, /useActivity/);
  assert.doesNotMatch(quests, /localStorage\.getItem\('physiquequest-quests'\)/);
  assert.match(notifications, /useNotifications/);
  assert.doesNotMatch(notifications, /const initial =/);
});

test('camera and scan capabilities never present fabricated AI results', async () => {
  const camera = await source('sections/Coach/CameraCheck.tsx');
  const review = await source('sections/Scan/ReviewEstimate.tsx');
  const scan = await source('sections/Scan/ScanSection.tsx');
  assert.match(camera, /useCameraStream/);
  assert.match(camera, /getPoseStatus/);
  assert.doesNotMatch(camera, /Distance 2\.7 m · in range/);
  assert.doesNotMatch(camera, /value="Detected"/);
  // The review screen must show what the scan endpoint returned, never a
  // hardcoded stand-in for a result that was never requested.
  assert.match(scan, /analyzeImage/);
  assert.match(scan, /addMealsFromScan/);
  assert.doesNotMatch(review, /Image analysis is unavailable/);
  assert.doesNotMatch(scan, /Grilled chicken rice bowl/);
  assert.doesNotMatch(review, /Grilled chicken breast/);
  assert.doesNotMatch(review, /Estimated macros · sample values/);
});

test('a scan waits visibly, then offers a retry once it hits the limit', async () => {
  const api = await source('lib/api.ts');
  const review = await source('sections/Scan/ReviewEstimate.tsx');
  const scan = await source('sections/Scan/ScanSection.tsx');

  // The give-up point must be a real enforced deadline, not a label: an
  // unbounded fetch leaves the screen spinning forever on a dropped request.
  assert.match(api, /SCAN_TIMEOUT_MS = 60_000/);
  assert.match(api, /AbortController/);
  assert.match(api, /timeoutMs/);
  assert.match(api, /ApiTimeoutError/);

  // Progress is shown, not implied, and the timer is cleaned up per attempt.
  assert.match(review, /setInterval/);
  assert.match(review, /clearInterval/);
  assert.match(review, /Waiting for the result/);
  assert.match(review, /SCAN_TIMEOUT_MS/);

  // A timeout is reported as a timeout, and recovery stays a deliberate tap
  // rather than an automatic resend that would stack scans on the provider.
  assert.match(scan, /ApiTimeoutError/);
  assert.match(review, /Try again/);
  assert.doesNotMatch(scan, /setTimeout\(.*analyse/);
});

test('coach plan restores the legacy workout dashboard', async () => {
  const file = await source('sections/Coach/CoachPlan.tsx');
  assert.match(file, /Week 3 · 4 sessions planned/);
  assert.match(file, /AI tracked/);
  assert.match(file, /Dumbbell bench press/);
});

test('native wrapper reports backend connectivity and can retry it', async () => {
  const mobile = await readFile(new URL('../../mobile/App.tsx', import.meta.url), 'utf8');
  assert.match(mobile, /backend-status/);
  assert.match(mobile, /Retry backend check/);
  assert.match(mobile, /injectJavaScript/);
});

test('launch readiness renders live device, network, and camera state', async () => {
  const file = await source('app/launch/page.tsx');
  assert.match(file, /DeviceReadiness/);
  assert.match(file, /Device OS version/);
  assert.match(file, /Wi-Fi/);
  assert.match(file, /Camera permission/);
  assert.doesNotMatch(file, /Android 14 detected/);
  assert.doesNotMatch(file, /84 Mbps/);
  assert.match(file, /requestCameraPermission/);
});

test('Expo shell uses native readiness APIs and bridges camera permission', async () => {
  const mobile = await readFile(new URL('../../mobile/App.tsx', import.meta.url), 'utf8');
  assert.match(mobile, /expo-device/);
  assert.match(mobile, /expo-camera/);
  assert.match(mobile, /@react-native-community\/netinfo/);
  assert.match(mobile, /expo-network/);
  assert.match(mobile, /requestCameraPermissionsAsync/);
  assert.match(mobile, /osName/);
  assert.match(mobile, /osVersion/);
  assert.match(mobile, /device-readiness/);
});

test('authenticated navigation uses full document navigation in WebView', async () => {
  const navigation = await source('lib/navigation.ts');
  const login = await source('app/(auth)/login/page.tsx');
  const register = await source('app/(auth)/register/page.tsx');
  const bottomNav = await source('sections/Home/BottomNav.tsx');
  assert.match(navigation, /window\.location\.assign/);
  assert.match(login, /navigate\('\/home'\)/);
  assert.match(register, /navigate\('\/home'\)/);
  assert.doesNotMatch(bottomNav, /router\.push\(path\)/);
});

test('scan errors keep the backend message instead of a generic fallback', async () => {
  const api = await source('lib/api.ts');
  const scan = await source('sections/Scan/ScanSection.tsx');
  // AppError bodies nest the payload under `error`, so reading message/code off
  // the top level silently produced 'An error occurred' for every failure.
  assert.match(api, /typeof nested === 'object'/);
  assert.match(api, /throw new ApiRequestError\(message, response\.status, error\.code\)/);
  assert.doesNotMatch(api, /'An error occurred'/);
  // An upstream timeout is the provider being slow, not a bad photo.
  assert.match(scan, /err\.statusCode===504/);
  assert.match(scan, /UPSTREAM_TIMEOUT/);
});
