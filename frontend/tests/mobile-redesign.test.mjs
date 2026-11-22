import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('progress displays saved measurement history and honest empty states', async () => {
  const file = await source('sections/Home/Progress.tsx');
  assert.match(file, /useProgress/);
  assert.match(file, /Save measurement/);
  assert.match(file, /Add your first measurement to see your trend/);
  assert.match(file, /useWorkoutHistory/);
  assert.match(await source('hooks/useWorkoutHistory.ts'), /api\.getAllWorkouts\(force\)/);
  assert.match(file, /completedWorkouts/);
  assert.match(file, /PersonalRecords/);
  assert.doesNotMatch(file, /samplePersonalRecords/);
});

test('notifications use account records and display an honest empty state', async () => {
  const file = await source('sections/Home/Notifications.tsx');
  assert.match(file, /useNotifications/);
  assert.match(file, /markAllRead/);
  assert.match(file, /Try again/);
  assert.match(file, /!items\.length && !error/);
  assert.match(file, /New notifications will appear here/);
  assert.doesNotMatch(file, /sampleNotifications/);
});

test('notification read actions use account-backed hooks', async () => {
  const file = await source('sections/Home/Notifications.tsx');
  assert.match(file, /markRead\(safety\.id\)/);
  assert.match(file, /void markRead\(item\.id\)/);
  assert.match(file, /void markAllRead\(\)/);
});

test('notifications pin real safety alerts and preserve truthful actions', async () => {
  const file = await source('sections/Home/Notifications.tsx');
  const styles = await source('app/globals.css');
  assert.match(file, /sorted\.find\(item =>/);
  assert.match(file, /item\.icon === 'shield'/);
  assert.match(file, /aria-label="Pinned safety notice"/);
  assert.match(file, /Safety notice · pinned/);
  assert.match(file, /Mark as read/);
  assert.match(file, /notification-unread-label/);
  assert.match(file, /aria-label="Your notifications"/);
  assert.match(styles, /\.home-notifications \.notification-safety-card/);
  assert.match(styles, /\.home-notifications \.notification-item\.unread/);
});

test('Me keeps persistence and root navigation', async () => {
  const file = await source('sections/Me Section/MeSection.tsx');
  assert.match(file, /useSettings/);
  assert.doesNotMatch(file, /localStorage\.getItem\('physiquequest-me-settings'\)/);
  assert.doesNotMatch(file, /localStorage\.setItem\('physiquequest-me-settings'/);
  assert.match(file, /<BottomNav \/>/);
});

test('launch actions use client navigation without reloading the WebView', async () => {
  const file = await source('app/launch/page.tsx');
  assert.match(file, /<Link className="primary" href="\/register">/);
  assert.match(file, /<Link className="secondary" href="\/login">/);
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
  // Review-a-video no longer opens a live stream: the live camera moved to the
  // native shell. What still has to hold is that the screen asks the server
  // whether analysis is available and renders only what came back.
  assert.match(camera, /getPoseStatus/);
  assert.match(camera, /api\.analyzePose\(/);
  assert.match(camera, /Video analysis is temporarily unavailable/);
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
  // The exact deadline is a product decision; that one is enforced is not.
  assert.match(api, /SCAN_TIMEOUT_MS = \d[\d_]*;/);
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

test('coach plan renders a library-backed workout dashboard', async () => {
  const file = await source('sections/Coach/CoachPlan.tsx');
  assert.match(file, /useCoachPlan/);
  assert.match(file, /AI tracked/);
  assert.match(file, /plan\.libraryReady/);
  assert.match(file, /Start session/);
});

test('native wrapper reports backend connectivity and can retry it', async () => {
  const mobile = await readFile(new URL('../../mobile/App.tsx', import.meta.url), 'utf8');
  assert.match(mobile, /backend-status/);
  // The shell has no separate "change server" control: the recovery screen is
  // the address field itself, so that is what has to stay present.
  assert.match(mobile, /accessibilityLabel="Server address"/);
  assert.match(mobile, /onPress={connect}/);
  assert.match(mobile, /injectJavaScript/);
});

test('launch readiness renders live device, network, and camera state', async () => {
  const file = await source('app/launch/page.tsx');
  assert.match(file, /DeviceReadiness/);
  assert.match(file, /deviceOsStatus/);
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

test('Expo camera preview uses the native camera instead of insecure WebView media APIs', async () => {
  const mobile = await readFile(new URL('../../mobile/App.tsx', import.meta.url), 'utf8');
  const cameraHook = await source('hooks/useCameraStream.ts');
  assert.match(mobile, /<CameraView/);
  assert.match(mobile, /camera-start/);
  assert.match(mobile, /camera-update-frame/);
  assert.match(mobile, /camera-stop/);
  assert.match(cameraHook, /ReactNativeWebView/);
  assert.match(cameraHook, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.doesNotMatch(cameraHook, /Open the app over https or through the Expo app/);
});

test('the live session waits for its visible frame, supports both cameras, and uses local live readiness', async () => {
  // The live preview moved out of Camera Check (now upload-only) and into the
  // session screens, so the frame and facing guards follow it there.
  const camera = await source('sections/Coach/LiveSession.tsx');
  const cameraHook = await source('hooks/useCameraStream.ts');
  const mobile = await readFile(new URL('../../mobile/App.tsx', import.meta.url), 'utf8');
  const api = await source('lib/api.ts');
  assert.match(camera, /ref={camera\.frameRef}/);
  assert.match(cameraHook, /frameRef\.current/);
  assert.doesNotMatch(cameraHook, /camera preview is not visible yet/);
  assert.match(camera, /camera\.switchFacing/);
  assert.match(cameraHook, /requestedFacing === 'front' \? 'user' : 'environment'/);
  assert.doesNotMatch(camera, /analysisType: 'readiness'/);
  assert.doesNotMatch(camera, /camera\.captureFrame/);
  // Framing feedback is drawn by the native shell from the readiness context
  // the web app publishes, so the wording lives in mobile/App.tsx now.
  assert.match(mobile, /nativeFramingText/);
  assert.match(mobile, /Keep your whole body in view/);
  assert.doesNotMatch(mobile, /camera-capture-readiness|takePictureAsync/);
  assert.doesNotMatch(cameraHook, /camera-capture-readiness|captureFrame/);
  assert.match(mobile, /readinessScript/);
  assert.match(mobile, /validateNativeReadinessContext/);
  assert.match(api, /analysisType\?: 'workout' \| 'readiness'/);
  assert.match(api, /requestedChecks\?: \('fullBodyInFrame' \| 'lighting' \| 'distance'\)\[\]/);
});

test('camera readiness displays only results actually present in provider analysis', async () => {
  const file = await source('lib/cameraReadiness.ts');
  const compiled = ts.transpileModule(file, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', compiled)(module.exports, module);
  const { parseCameraReadiness, readyCheckCount } = module.exports;

  const measured = parseCameraReadiness({
    readiness: {
      fullBodyInFrame: true,
      lighting: 'sufficient',
      distance: { meters: 2.7 },
    },
  });
  assert.deepEqual(measured.fullBody, { status: 'ready', label: 'Detected' });
  assert.deepEqual(measured.lighting, { status: 'ready', label: 'Sufficient' });
  assert.deepEqual(measured.distance, { status: 'ready', label: '2.7 m · in range' });
  assert.equal(readyCheckCount(measured, true), 4);

  const missing = parseCameraReadiness({ summary: 'Camera view received.' });
  assert.equal(missing.fullBody.status, 'unknown');
  assert.equal(missing.lighting.status, 'unknown');
  assert.equal(missing.distance.status, 'unknown');
  assert.equal(readyCheckCount(missing, true), 1);
  assert.equal(parseCameraReadiness({ distance: { meters: 3.6 } }).distance.status, 'adjust');
});

test('safety phases replace the session, cancel stale phases, and restore the selected camera', async () => {
  const live = await source('sections/Coach/LiveSession.tsx');
  const css = await source('app/globals.css');
  const mobile = await readFile(new URL('../../mobile/App.tsx', import.meta.url), 'utf8');
  assert.match(live, /phaseRef\.current === 'active'/);
  // Alarm transitions and late cancellations are exercised by emergency-session.test.mjs.
  assert.match(live, /detail\.type === 'countdown-started'[\s\S]*?camera\.stop\(\)/);
  assert.match(live, /camera\.shouldAutoStart && camera\.status === 'idle'/);
  assert.match(live, /!\s*camera\.nativePreview\s*&&\s*<>\s*<span className="form-score"/);
  assert.match(css, /\.coach-view-session \.inactivity-view\s*\{[^}]*position: absolute/s);
  assert.match(mobile, /detail\.type === 'countdown-started'.*setCameraPreview\(null\)/s);
});

test('Live Session uses a proper pause icon and hides duplicate native-preview labels', async () => {
  const live = await source('sections/Coach/LiveSession.tsx');
  const icons = await source('sections/Home/icons.tsx');
  const css = await source('app/globals.css');

  assert.match(live, /<Icon name="pause" size=\{16\}/);
  assert.match(live, /aria-label=\{paused \? 'Resume workout' : 'Pause workout'\}/);
  assert.match(icons, /pause:.*M7 5h3v14H7zM14 5h3v14h-3z/s);
  assert.doesNotMatch(live, /pause-glyph/);
  assert.doesNotMatch(css, /\.pause-glyph/);
});

test('live inactivity countdown and alarm have connected safety UI and persistent resolution', async () => {
  const live = await source('sections/Coach/LiveSession.tsx');
  const views = await source('sections/Coach/InactivityViews.tsx');
  const styles = await source('app/globals.css');
  const holdComplete = live.match(/const holdComplete = async \(\) => \{([\s\S]*?)\n  \};/);

  assert.match(live, /phase === 'countdown'/);
  assert.match(live, /phase === 'alarm'/);
  assert.ok(holdComplete, 'alarm hold-stop handler should exist');
  assert.match(holdComplete[1], /resolveAlert/);
  assert.doesNotMatch(holdComplete[1], /setPhase\('active'\)/);
  assert.match(views, /className="inactivity-view inactivity-countdown"/);
  assert.match(views, /className="inactivity-view emergency-alarm"/);
  assert.match(views, /api\.getAdminAlerts\(30\)/);
  assert.match(views, /canViewAdmin &&/);
  assert.match(styles, /\.coach-view-session \.inactivity-countdown/);
  assert.match(styles, /\.coach-view-session \.emergency-alarm/);
});

test('auth boundaries and signed-in tabs use client navigation without a startup interstitial', async () => {
  const login = await source('app/(auth)/login/page.tsx');
  const register = await source('app/(auth)/register/page.tsx');
  const bottomNav = await source('sections/Home/BottomNav.tsx');
  const boundary = await source('components/SessionBoundary.tsx');
  assert.match(login, /push: navigate.*useRouter/);
  assert.match(register, /push: navigate.*useRouter/);
  assert.doesNotMatch(boundary, /Opening PhysiqueQuest/);
  assert.match(login, /await login\(email, password\);[\s\S]*navigate\('\/register'\)/);
  assert.match(register, /navigate\('\/home'\)/);
  assert.match(bottomNav, /router\.push\(path\)/);
  assert.match(bottomNav, /router\.prefetch\(tab\.path\)/);
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
