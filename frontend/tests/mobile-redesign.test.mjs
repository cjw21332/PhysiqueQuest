import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('progress displays saved measurement history and honest empty states', async () => {
  const file = await source('sections/Home/Progress.tsx');
  assert.match(file, /useProgress/);
  assert.match(file, /Save measurement/);
  assert.match(file, /Log your first .* to start a trend/);
  assert.match(file, /api\.getWorkouts\(\)/);
  assert.match(file, /completedWorkouts/);
  assert.match(file, /samplePersonalRecords/);
  assert.match(file, /Sample data/);
  assert.match(file, /Form accuracy/);
});

test('notifications prefer API records and show the requested preview only for a successful empty response', async () => {
  const file = await source('sections/Home/Notifications.tsx');
  assert.match(file, /useNotifications/);
  assert.match(file, /markAllRead/);
  assert.match(file, /Try again/);
  assert.match(file, /const sampleNotifications: AppNotification\[\]/);
  assert.match(file, /!loading && !error && items\.length === 0/);
  assert.match(file, /showingSamples \? sampleItems : items/);
  assert.match(file, /Emergency alert sent — Nov 14, 7:42 PM/);
  assert.match(file, /Maria Dela Cruz was notified\. Review the flagged session\./);
  assert.match(file, /2 missions left/);
  assert.match(file, /Post-workout report ready/);
  assert.match(file, /Streak penalty applied/);
  assert.match(file, /New badge unlocked/);
  assert.match(file, /Sample notifications · live notifications will replace this preview\./);
  assert.match(file, /This sample alert is not linked to a real session\./);
});

test('sample notification read actions stay local and do not call the API', async () => {
  const file = await source('sections/Home/Notifications.tsx');
  assert.match(file, /if \(showingSamples\) \{\s+setSampleItems/);
  assert.match(file, /if \(showingSamples\) \{\s+setSampleItems\(current => current\.map\(sample => \(\{ \.\.\.sample, unread: false \}\)\)\)/);
  assert.match(file, /void markRead\(item\.id\)/);
  assert.match(file, /void markAllRead\(\)/);
});

test('notifications pin real safety alerts and preserve truthful actions', async () => {
  const file = await source('sections/Home/Notifications.tsx');
  const styles = await source('app/globals.css');
  assert.match(file, /displayedItems\.find\(item =>/);
  assert.match(file, /item\.icon === 'shield'/);
  assert.match(file, /<SafetyNotification\s+item=\{pinnedSafety\}/);
  assert.match(file, /Safety notice · pinned/);
  assert.match(file, /Mark as read/);
  assert.match(file, /notification-unread-label/);
  assert.match(file, /aria-label=\{\`\$\{group\} notifications\`\}/);
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

test('Camera Check waits for its visible frame, supports both cameras, and requests live readiness analysis', async () => {
  const camera = await source('sections/Coach/CameraCheck.tsx');
  const cameraHook = await source('hooks/useCameraStream.ts');
  const mobile = await readFile(new URL('../../mobile/App.tsx', import.meta.url), 'utf8');
  const api = await source('lib/api.ts');
  assert.match(camera, /ref={live\.frameRef}/);
  assert.match(cameraHook, /frameRef\.current/);
  assert.doesNotMatch(cameraHook, /camera preview is not visible yet/);
  assert.match(camera, /live\.switchFacing/);
  assert.match(cameraHook, /requestedFacing === 'front' \? 'user' : 'environment'/);
  assert.match(camera, /analysisType: 'readiness'/);
  assert.match(camera, /requestedChecks: \['fullBodyInFrame', 'lighting', 'distance'\]/);
  assert.match(camera, /Full body in frame/);
  assert.match(camera, /Lighting/);
  assert.match(camera, /Distance/);
  assert.match(mobile, /camera-capture-readiness/);
  assert.match(mobile, /takePictureAsync/);
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
  assert.match(live, /phaseRef\.current === 'countdown'/);
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
