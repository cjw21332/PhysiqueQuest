# PoseTracker mobile compatibility

## Current implementation

The Android build uses the native `expo-mediapipe-pose` 0.3.0 wrapper with MediaPipe Tasks Vision Android 0.10.29. `mobile/NativeTrackingCamera.tsx` loads `mobile/assets/pose_landmarker_lite.task` using Expo Asset. Configuration selects Lite, one pose, segmentation off, and confidence thresholds of 0.6. The native camera preview runs independently of the lower-rate inference callbacks; callback processing is throttled when inference is slow or thermal conditions require it. Pose inference is on-device.

The browser path is separate: `frontend/workers/pose.worker.ts` uses `@mediapipe/tasks-vision` 0.10.32, VIDEO mode, CPU delegate, and the same Lite task. The local mobile uploaded-video flow samples frames and calls the deterministic shared engine. Neither path loads `pattern_v1`, the nested synthetic/GIF models, or `attention_w48`; no ONNX Runtime integration/import was found in the mobile app.

## Candidate check

Fresh experiment inputs/outputs are 48×132 and seven logits. The current MediaPipe wrapper returns pose landmarks, not that temporal tensor. Feature ordering and normalization do not match the live deterministic rule path. There is no app-side ONNX runtime, loader, tensor adapter, model lifecycle, or fallback contract for these experimental classifiers. Therefore the candidate is not directly compatible, regardless of desktop CPU speed. Export/quantization and device resource claims are N/A; CPU ONNX microbenchmark is desktop only.

## Device regression status

No OPPO CPH2591 device session was available/executed during this audit. The user reports the existing Android development build is installed and running; this is not a test result for the audited candidate. No camera permission, initialization, landmark, rep, form, uploaded-video, offline, or save/review flows were re-tested in this task. No workout was written. Because no model is accepted, there was no candidate to integrate or test. Current code changes in this audit are limited to audit snapshot inventory coverage and documentation.

## Compatibility decision

Retain the current MediaPipe Lite + deterministic shared engine. Do not integrate the classifier candidates. First define a versioned feature contract, correct preprocessing in a new version, prove parity in a shared implementation, establish a supported runtime/adapter, then run a controlled build and device regression with a disposable account/test data. Do not change the working development build or MediaPipe dependency for these rejected experiments.
