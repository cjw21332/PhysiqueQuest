import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('progress restores the legacy visual dashboard', async () => {
  const file = await source('sections/Home/Progress.tsx');
  assert.match(file, /const series/);
  assert.match(file, /68\.5/);
  assert.match(file, /Personal records/);
  assert.match(file, /Recent sessions/);
});

test('notifications restore the legacy mock feed with local read state', async () => {
  const file = await source('sections/Home/Notifications.tsx');
  assert.match(file, /const initial =/);
  assert.match(file, /Safety notice · pinned/);
  assert.match(file, /setItems/);
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
  assert.match(notifications, /const initial = \[/);
  assert.match(notifications, /setItems/);
});

test('camera and scan capabilities never present fabricated AI results', async () => {
  const camera = await source('sections/Coach/CameraCheck.tsx');
  const review = await source('sections/Scan/ReviewEstimate.tsx');
  assert.match(camera, /Live pose tracking is unavailable/);
  assert.doesNotMatch(camera, /Distance 2\.7 m · in range/);
  assert.doesNotMatch(camera, /value="Detected"/);
  assert.match(review, /Image analysis is unavailable/);
  assert.doesNotMatch(review, /Grilled chicken breast/);
  assert.doesNotMatch(review, /Estimated macros · sample values/);
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
