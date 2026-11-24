# PoseTracker Device Validation

Date: 2026-11-16
Status: **NOT VERIFIED**

No Android or iOS device was connected for this work. Nothing in this document is a device
measurement. No camera feed was mocked and reported as device evidence. The synthetic tests below
verify the exercise engine's logic, not real-person counting accuracy or device performance.

## Attempt log

### 2026-11-16 — Android development build

An attempt to start the protocol in this environment was made and stopped at the tooling check:

```text
$ command -v adb
adb: missing
$ echo $ANDROID_HOME
unset
$ adb devices
bash: adb: command not found
$ command -v emulator
emulator: missing
```

No Android SDK, platform tools, emulator, attached device or installed development build was
available. No app was installed, no camera session was started and no video was analyzed. No device
result was collected, so this section records a blocked attempt, not a validation run. The status of
every item in the table below remains **NOT RUN**.

To unblock, provide a machine with Android platform tools and a connected physical device, then run
the protocol below. An emulator is not a substitute for the physical-camera portion of this protocol.

## Current evidence status

| Evidence | Status | Source |
|---|---|---|
| Engine unit tests | PASSED (synthetic landmarks) | `shared/__tests__/exerciseEngine.spec.ts`, 18 tests |
| Video pipeline tests | PASSED (synthetic frames) | `shared/__tests__/videoAnalysisPipeline.spec.ts`, 5 tests |
| Backend registry/launch tests | PASSED (mock catalog) | `backend/test/pose-tracker.spec.ts`, 24 tests |
| Frontend registry/bridge tests | PASSED | `node --test frontend/tests/pose-tracker.test.mjs`, 9 tests |
| Typecheck, backend `src/pose-tracker` | PASSED | `npx tsc -p backend/tsconfig.json --noEmit` filtered to `src/pose-tracker` |
| Typecheck, frontend | PASSED | `npx tsc -p frontend/tsconfig.json --noEmit` |
| Typecheck, mobile | PASSED | `npx tsc -p mobile/tsconfig.json --noEmit` |
| Native live camera on a physical device | **NOT RUN** | — |
| Native uploaded-video analysis on a physical device | **NOT RUN** | — |
| Camera permission denial | **NOT RUN** | — |
| Cancellation and temp-file cleanup on device | **NOT RUN** | — |
| Thermal, memory and long-session behavior | **NOT RUN** | — |
| Per-exercise rep/hold accuracy | **NOT MEASURED** | — |
| Exercise classified FULLY SUPPORTED | **0 exercises** | `EXERCISEDB_V1_TRACKING_COVERAGE.md` |

## Prerequisites for a real run

1. A development build, not Expo Go. `expo-mediapipe-pose` is a native module and the screen
   explicitly falls back to "Camera tracking unavailable" when the module is absent.
2. The pose model asset must be present at `mobile/assets/pose_landmarker_lite.task`; the live and
   video paths both load it through `expo-asset`.
3. A reachable backend so the web UI can resolve and launch the exercise configuration.
4. A signed-in test account. PoseTracker configuration is fetched with the user's session.
5. This build (`mobile/package.json` includes `expo-document-picker ~58.0.5`).

Suggested build commands, to be executed on a machine with a connected device:

```bash
npm run start:tracking          # Expo dev client
cd mobile && npx expo run:android --device
cd mobile && npx expo run:ios --device
```

## Required device protocol

Record device model, OS version, build hash, app version, lighting, camera distance and the exact
exercise ID for every run. Do not merge results across exercises or pattern families.

### 1. Live camera, one exercise per counting mode

| Case | Exercise type | What must be observed |
|---|---|---|
| Bilateral reps | squat-family, e.g. a catalog squat | Reps only increase after a full down-and-up cycle; partial bottom does not count; angle and ROM update |
| Per-side reps | curl-family, e.g. a dumbbell curl | Left and right counts are independent; one side's partial rep does not increment the other |
| Alternating reps | lunge-family | Each completed side counts once; switching sides does not double count |
| Static hold | `core_isometric`, e.g. a plank | Hold timer runs only while the body line is held; drift beyond tolerance resets the hold; a hold shorter than the minimum does not count |
| Fast pattern | `jumping_jack` / `high_knees` | Counts are plausible at the pattern's min/max rep duration; no runaway counting from jitter |

Pass criteria:

- Zero counts when the body is out of frame or only partly visible.
- No rep is counted from a single frame of noise at the peak.
- Rep count is reproducible across two consecutive sets of the same performed count.
- The support banner says partially supported or not yet validated and never "verified".

### 2. Uploaded video

Use a short locally recorded clip of the same exercise and the same performer as the live case.

- Choose the file through the system document picker.
- Confirm progress advances and the final screen reports reps/holds, partials and ROM.
- Confirm the file is not uploaded: run with network inspection or airplane mode after the config is
  loaded, and confirm no request carries the video.
- Cancel halfway. The screen must say the analysis was cancelled, and no result may be shown.
- After completion and after cancellation, confirm the picker's cache copy no longer exists.
- Repeat the same clip twice and confirm the same count, apart from documented sampling variance.
- Compare the video count with the live count for the same performed set. Any difference must be
  recorded, not explained away.

### 3. Failure handling

- Deny camera permission: the screen must not claim tracking is active; the video option must remain
  available.
- Background the app during a session: the native session must close rather than continue silently.
- Kill and reopen: no stale session, no stale temp video.
- Run a 10+ minute live session and a long video: record memory, thermal state, frame rate and any
  dropped frames.
- Rotate or switch camera: geometry changes must not corrupt counts; the existing geometry guard may
  restart the camera.

### 4. Accuracy measurement

Accuracy is not established by "it looked right". For each tested exercise, record:

- performed reps or hold seconds (ground truth by manual count/stopwatch),
- detected reps or hold seconds,
- exact match, within ±1, absolute error,
- whether the performer was in the intended camera view,
- any occlusion or equipment.

A pattern family may only be called validated when it has pooled real-person evidence of at least 25
sets and at least 70% within ±1, with the raw trials retained. That gate has not been met. Until it is,
the correct classification remains PARTIALLY SUPPORTED or NOT YET VALIDATED, and no exercise may be
marked FULLY SUPPORTED.

## Known risks to check on device

- MediaPipe landmark jitter at the start/peak thresholds can double-count or miss fast reps.
- The per-side state machine can attribute a rep to the wrong side when the body is close to the
  frame edge.
- Floor exercises (push-ups, planks, hip thrusts) have a different camera geometry than standing
  exercises; verify that the pattern's expected view matches what the user can actually set up.
- Hold patterns depend on drift tolerance; a shaky camera can reset holds that a person is holding.
- Video sampling at 12 fps may miss very fast reps; a mismatch against live counts is a real finding,
  not a test failure to hide.
- Model loading and the first inference can be slow on low-end devices; the startup timeout must not
  fire before the model is ready.

## Sign-off rule

This file may only change from NOT VERIFIED after the protocol above has been run on real hardware
and the raw observations are attached. Updating this file without those observations would be
fabricated validation and is not permitted.
