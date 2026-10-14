# Camera rep-counting prototype

Open **AI Coach** and choose **Bodyweight squat** or **Standing biceps curl** under
**Camera rep counting · beta**. Select the side facing the camera, then enable the
camera. Position the required joints as directed. After finishing, review/correct
the count and save the workout. The starter exercises are local presets and do
not depend on an external catalog. These rules are experimental rather than
validated exercise-form assessments:

- `camera-squat`: Bodyweight squat; hip/knee/ankle movement.
- `camera-curl`: Standing biceps curl; shoulder/elbow/wrist movement, one arm at a time.

## Browser

Use HTTPS or localhost and a browser supporting workers, OffscreenCanvas and
ImageBitmap. The locally hosted MediaPipe Lite model runs in a worker, capped at
10 inferences/second with one frame in flight. Slow inference reduces the target
to as low as 2/second. Camera input requests 640×480 and 24 fps; analyzed frames
are resized to at most 480 pixels wide. Camera configuration is subject to device
capabilities. The page exposes the processing target, not a hardware benchmark.

Enable-camera is explicit. Pausing, reviewing, hiding the page or leaving the
screen stops camera capture and releases the worker. Resume requires enabling
the camera again. Model/camera failures retain the manual review/save path.

## Android and iPhone

The app integrates `expo-mediapipe-pose` 0.3.0, targeting the existing Expo 57 /
React Native 0.86 versions. Native capture/inference stays on the device; only
three selected joints, their confidence, aspect ratio and timestamps cross the
WebView bridge. Native tracking uses the same shared counter as the browser.
It starts at 10 inferences/second, disables segmentation and skeleton overlays,
reduces to 5 when inference is slow or thermal state is serious, and stops on
critical thermal state. Metrics show measured inference rate on native.

Expo Go supports camera preview and manual counting, but cannot load this native
tracking module. Normal `start`/`expo` scripts explicitly use `--go`, so installing
the development client dependency does not change their launch target. Run
`npm run start --workspace mobile -- --clear` from the repository root to open Expo Go with a fresh
bundle, or press `s` in an existing Expo terminal to switch its launch target.
Install a development build using the mobile workspace's
`android` or `ios` script, then use `start:tracking` to run it. Native builds require
Android Studio/SDK and a compatible JDK for Android; iOS compilation requires a
Mac with Xcode, or a separately configured cloud build. No cloud build is created
by this change.

`mobile/metro.config.js` includes `.task` as an asset extension. The Lite model is
bundled through `expo-asset`; the native view owns capture, and the existing Expo
camera is used for permission handling and ordinary non-tracking previews.
The native camera stops in the background, with motion history reset on camera
reconfiguration and app-state changes. Counts already completed are preserved.

## Counting and persistence

The shared counter requires visible, confident joints inside the frame, smooths
joint angles, and confirms positions for 150 ms. It requires an initial straight
position, a bent position, and a return to straight before counting. Lost or stale
joints invalidate unfinished movement. Side changes and camera restarts also
invalidate unfinished movement. Thresholds are prototype rules requiring device
and user validation, not measurements of exercise quality.

Explicit pause/resume and the review phase use the existing workout pause API.
Reviewed rep counts use `exerciseResults` on the existing completion API with the
selected local preset ID. Video and landmark frames are not sent to the backend or saved.
The server still derives workout duration from session timestamps and explicit
pauses; hiding the app suspends tracking but does not automatically pause the
server's workout timer.

## Verification and remaining device checks

- `node --test frontend/tests/rep-counter.test.mjs`: synthetic landmark sequences
  cover full/partial reps, jitter, uncertainty, offscreen/stale joints, resets,
  chronology and image aspect ratio. These tests do not establish camera accuracy.
- Build the frontend, then run
  `node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs`.
  This uses real local model inference with Chromium's synthetic camera and a
  mocked workout API. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if needed.
- Mobile TypeScript checks and Android/iOS Expo exports validate source and asset
  bundling. They do not replace native compilation or physical-camera tests.

Before treating camera counts as reliable, test both platforms with real users,
front/back cameras, portrait/landscape, lighting, occlusion, pauses and app
interruptions. Compare counted reps with manually counted sets. Measure a
15-minute session against camera-preview-only baseline for frame timing, memory,
heat and battery. No accuracy or battery-saving claim has been established.

## Model and dependencies

Google MediaPipe Pose Landmarker Lite float16 version 1:
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task

SHA-256: `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.
Copies are in `frontend/public/pose` and `mobile/assets`.
Browser runtime/WASM files come from `@mediapipe/tasks-vision` 0.10.32; when updating
that dependency, replace the files under `frontend/public/pose/wasm` with its WASM
directory. Keep the runtime and WASM versions aligned.

MediaPipe is provided by Google under its upstream license; the native wrapper
is MIT-licensed and preserves its upstream notices. See `THIRD_PARTY_NOTICES.md`.
