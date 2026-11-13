# Integration Plan: PoseTracker & Coach Frontend

## (a) Live Session
- **Files**: `backend/src/pose-tracker/exercise-registry.ts`, `frontend/services/poseTracker/bridge.ts`, `frontend/components/PoseTrackerView.tsx`
- **Plan**: Serve the 5 beta configs with updated joints (jumping jack and pull-up use shoulder joints). Expose `Auto-count (beta)` badge based on `trackingTier`. Add a +/- adjustment step before saving count.
- **Risks**: UI jitter during high-framerate pose tracking and adjustment.
- **Tests**: E2E test verifying badge rendering and set count adjustment before commit.
- **Effort**: 3 days.

## (b) Upload Flow
- **Files**: `frontend/lib/api.ts`, `frontend/services/poseTracker/uploader.ts`, `backend/src/chat/chat.controller.ts`
- **Plan**: User picks exercise from library. If beta exercise, run local ONNX/MediaPipe pose counter (downscaled video frames to max width 480). Otherwise fallback to Gemini server-side analysis returning `AnalysisReport`.
- **Risks**: Client-side memory limits and WebAssembly / MediaPipe performance on mobile web.
- **Tests**: Integration test verifying fallback route when exercise is non-beta vs local execution for beta.
- **Effort**: 4 days.

## (c) FEATURE_LOCAL_ML Flag & Device-Tier Handling
- **Files**: `shared/config.ts`, `frontend/hooks/useDeviceTier.ts`, `backend/src/common/config.ts`
- **Plan**: Introduce `FEATURE_LOCAL_ML` feature flag. Implement device tier detection (low-tier vs high-tier mobile) to conditionally disable local ML and force cloud fallback.
- **Risks**: False positives in device capability detection leading to laggy sessions.
- **Tests**: Unit tests for flag evaluation and device tier fallback logic.
- **Effort**: 1 day.
