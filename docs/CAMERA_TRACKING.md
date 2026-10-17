# Camera rep-counting prototype

## Recorded videos

From Camera check, choose **Upload video**, then select an MP4 or MOV up to 20 MB
and 2 minutes long. **Scan automatically when video opens** is enabled by default.
The app analyzes the clip once, checks both sides, and suggests a generic **Squat**,
**Biceps curl**, or **Push-up** plus its repetition count. Review/correct the result
before saving. Saved recording titles in the preview, history and report use the
reviewed exercise and count, for example **Push-up · 12 reps**. The original local
video filename is retained; the app does not rename or upload the source file.

Turn off automatic scanning before selecting a file for manual logging. You can
also correct the exercise after scanning. Manual counting supports **Bodyweight
squat**, **Goblet squat**, **Sumo squat**, **Standing biceps curl**, **Hammer curl**,
**Seated biceps curl**, or **Push-up** with an explicitly selected camera-facing
side. Choose **Count reps locally** to count using that selected rule.

The browser/WebView
decodes frames in order at 100 ms video-time intervals and uses the same local
worker, model and shared rep counter as live tracking. One resized frame is in
flight at a time. Processing speed depends on the device; no video or landmark
frames are sent to the pose provider. Model files may download on the first run.

### Automatic identification boundaries

Identification uses experimental movement rules on the existing model's full
33-landmark output, not a newly trained classifier. MediaPipe supplies body
landmarks rather than exercise labels; see the [official pose landmarker
guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker).
Six small counters (three movement families, two sides) consume the same pose
inference per sampled frame. No second model, backend inference, extra video pass,
or per-frame database write is introduced. Landmark frames are discarded as they
are processed; only reviewed results are persisted.

Use one person performing one supported exercise per clip, side-on, with their
full body visible. Identification requires at least one completed repetition,
at least ten eligible frames and eligible tracking in at least half the sampled
frames. These are implementation thresholds, not measured confidence scores or
accuracy statistics. Static poses, partial repetitions, insufficient visibility,
and competing completed movement-family cycles yield no automatic label. The
user must select an exercise before an unidentified clip can be saved.

The app does not distinguish squat/curl variations or recognize equipment from
landmarks. Automatically identified squats and curls therefore retain generic
names and empty equipment until a user explicitly selects a preset. It does not
split multi-exercise videos into separate entries, identify arbitrary catalog
exercises, assess form, or calculate calories. Real exercise videos and physical
phones still need validation; synthetic geometry tests are not an accuracy study.
Automatic results carry `movement-rules-v1/rep-counter-v2`; manual-rule counting
retains `rep-counter-v2`. Detected and reviewed rep counts remain separate.
Generic detected movements use `movement-squat`, `movement-curl`, and
`movement-pushup` identities, with the counting preset stored separately. This
keeps an uncertain variation from being merged into a specifically selected
exercise's personal records.

An uploaded clip attached to a planned set retains that set's catalog identity
and explicit counting rule; automatic identification never silently replaces the
selected catalog exercise. Cancellation, app backgrounding and leaving the
screen stop the worker without saving a result. Saving remains an explicit action.

Cancel, hide the app, or leave the upload screen to stop counting and release the
worker. Unsupported devices, undecodable videos, and clips without visible joints
retain manual rep entry. Review/correct the count and choose **Save reviewed
workout** to save one recorded set in a single authenticated operation. Choose its
performed time explicitly; clip duration is stored separately from activity time.
Retries reuse the same operation key. A standalone recording appears in history
and Progress but does not complete a training day. During a planned workout, use
**Apply recording to planned set** in that day's history to explicitly assign a
reviewed positive result to the matching exercise. This updates remaining sets
without counting the original recording twice. The app reuses or creates the
planned session, which must still be finished separately for daily credit. For
an upload made directly during a planned workout, use
the recorded-video option on the current set, explicitly select a matching rule,
and save the reviewed result to that set. Detected/reviewed reps, input source,
algorithm version and timing are retained; no video or landmark streams are saved.

Recorded counting runs in the WebView, so it does not need Expo Go's unavailable
custom native pose module. Codec and worker support still depend on the phone.
It counts prototype motion cycles for the supported exercises, without form
scores or calorie estimates. Test real clips on physical devices before relying
on accuracy. The hidden live-camera beta entry points remain hidden.

Squat and curl variations reuse their existing movement rules with separate IDs
and filming guidance. Push-ups use elbow bending (at most 100°) and extension
(at least 155°), plus visible shoulder/hip/ankle alignment and a near-horizontal
body to reject standing arm bends. Film standard floor push-ups from a level,
side-on camera; knee and incline push-ups are not supported. These checks only
gate counting and are not validated assessments of technique. All seven choices
reuse the existing model and frame limits, with no additional backend inference.

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
selected joints (three for squats/curls, five for push-ups), their confidence,
aspect ratio and timestamps cross the
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

Explicit pause/resume use the existing workout pause API. Entering review records
the finish timestamp locally without a separate pause request. Saving sends that
timestamp together with the reviewed results in one completion request, including
on retry, so time spent reviewing is excluded. If the review is abandoned, the
server session remains active until it is completed.
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
Copies are in `frontend/public/pose/v1` and `mobile/assets`.
Browser runtime/WASM files come from `@mediapipe/tasks-vision` 0.10.32; when updating
that dependency, publish a new version directory containing both the model and WASM
files, and update the worker asset base and the Next.js cache header rule together.
Keep the runtime and WASM versions aligned. Files under `/pose/v1/` are served with
`Cache-Control: public, max-age=31536000, immutable`; never replace their contents
at the same URL. Retain older version directories when releasing a new version
so already-open clients can still load them. Browsers may evict cached files, so
this reduces repeat downloads without guaranteeing offline operation. Native
tracking already bundles its model and does not download these web assets.

MediaPipe is provided by Google under its upstream license; the native wrapper
is MIT-licensed and preserves its upstream notices. See `THIRD_PARTY_NOTICES.md`.
