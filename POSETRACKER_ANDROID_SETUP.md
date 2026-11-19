# PoseTracker Android Development-Build Setup Guide

This guide documents the actual requirements for running the live-camera and
uploaded-video PoseTracker flows on a physical Android device. No device validation
has occurred — this is a setup prerequisite guide only.

## Prerequisites (verified against this repository)

### 1. Android Platform Tools

- `adb` (Android Debug Bridge) must be on PATH
- `ANDROID_HOME` or `ANDROID_SDK_ROOT` must point to an Android SDK installation
- `emulator` binary available (optional, for UI testing only; physical device required)
- `platforms;android-33` (or newer) SDK platform installed
- `build-tools;33.0.0` (or newer) build tools installed

**To install:**

```bash
# On Windows (Git Bash): use chocolatey or winget
#   choco install android-platform-tools
# Or download from: https://developer.android.com-studio

# On macOS:
#   brew install --cask android-platform-tools
#   OR install Android Studio

# Download SDK: https://developer.android.com-studio/#downloads
# Set ANDROID_HOME to the parent of the `platforms` and `build-tools` directories
```

### 2. Physical Device Requirements

- Android 8.0 (API 26) or newer — `expo-mediapipe-pose` requires native module
- USB debugging enabled in Developer Options on the device
- A USB cable connecting the device to the development machine
- The device must be recognized by `adb devices`

**Do not use Expo Go** for these flows. `expo-mediapipe-pose` is a native module
and the screen explicitly falls back to "Camera tracking unavailable" when the module
is absent in Expo Go. A development build is required.

### 3. Expo Development Client

```bash
# From the project root
npm run start:tracking  # or: npx expo start --dev-client

# This creates a development build that includes native modules.
# The first build may take 5-10 minutes.
```

### 4. Backend Service

- Backend must be running and reachable at the configured URL
- The PoseTracker configuration is fetched via the backend API
- Ensure the test account has a valid session
- Backend should be started with: `npm run start` or `npx tsx backend/src/index.ts`

### 5. Model Asset

- `mobile/assets/pose_landmarker_lite.task` (~5.7 MB) must be present
- Loaded through `expo-asset` from the development build
- If the asset is missing, the native session fails with "Model not found"

### 6. App Sign-in

- A test account must be signed in within the app
- PoseTracker configuration is fetched with the user's session
- Sign-in through the app's normal authentication flow

## Setup Checklist

| Item | Status | Notes |
|---|---|---|
| `adb` on PATH | _not verified_ | Install and add to PATH; run `adb version` |
| `ANDROID_HOME` / `ANDROID_SDK_ROOT` set | _not verified_ | Set to SDK root; verify with `echo $ANDROID_HOME` |
| `adb devices` shows device | _not verified_ | Connect device via USB; enable USB debugging |
| Development build installed | _not verified_ | `npx expo run:android --device` or Expo dev client |
| `pose_landmarker_lite.task` asset present | _not verified_ | Check `mobile/assets/` directory |
| Backend running and reachable | _not verified_ | Start backend; verify health endpoint |
| Test account signed in | _not verified_ | Use app sign-in flow |
| Camera permission granted (first run) | _not verified_ | Android will prompt at runtime |

## Recommended Build Command

```bash
cd mobile && npx expo run:android --device
```

or, using the dev client:

```bash
npm run start:tracking  # from project root
# Then in the Expo dev tools UI: press "Run on device"
```

**Do not claim device validation has occurred after running these steps.** The
prerequisites above only enable the app to build and launch; they do not constitute
a validation run. See `POSETRACKER_DEVICE_VALIDATION.md` for the formal validation
protocol that must be run on real hardware with recorded observations.

## Known Device Limitations (documented, not fabricated)

- MediaPipe landmark jitter at start/peak thresholds can double-count or miss fast reps
- Per-side state machine can attribute a rep to the wrong side when the body is close to the frame edge
- Floor exercises (push-ups, planks, hip thrusts) have different camera geometry than standing exercises; verify the pattern's expected view matches what the user can set up
- Hold patterns depend on drift tolerance; a shaky camera can reset holds that a person is holding
- Video sampling at 12 fps may miss very fast reps; a mismatch against live counts is a real finding, not a test failure to hide
- Model loading and first inference can be slow on low-end devices; the startup timeout must not fire before the model is ready
- `expo-document-picker ~58.0.5` is required for the uploaded-video path; see `mobile/package.json`

## Files Modified for This Build

- `mobile/package.json` — `expo-document-picker ~58.0.5` added
- `mobile/NativeTrackingCamera.tsx` — `fullLandmarks` added; `onProcessFrameLocal` removed
- `mobile/PoseTrackerNative.tsx` — live engine + local video analysis with `expo-document-picker`,
  `AbortController`, progress, `withTempVideoCleanup`
- `shared/videoAnalysisPipeline.ts` — `analyzeVideoLandmarks` with `override` and abort signal
- `shared/exerciseEngine.ts` — `ExerciseConfigOverride`, `resolvePatternSpec`, `sanitizeNativeOverride`