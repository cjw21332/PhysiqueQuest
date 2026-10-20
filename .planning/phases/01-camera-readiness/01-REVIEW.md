---
phase: 01-camera-readiness
reviewed: 2026-10-20T16:35:06Z
rechecked: 2026-10-20T16:38:18Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - shared/cameraReadiness.ts
  - frontend/hooks/useCameraReadiness.ts
  - frontend/hooks/useCameraStream.ts
  - frontend/workers/pose.worker.ts
  - frontend/sections/Coach/CameraCheck.tsx
  - mobile/App.tsx
  - mobile/NativeTrackingCamera.tsx
  - frontend/tests/camera-readiness.test.mjs
  - mobile/camera-readiness.test.mjs
  - frontend/tests/browser/camera-readiness.spec.mjs
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
resolved_findings:
  critical: 1
  warning: 1
  total: 2
status: clean
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-20T16:35:06Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** clean after narrow fix recheck; both original findings resolved

## Summary

Reviewed the new camera-readiness evaluator, web/native adapters, camera ownership changes, UI integration and readiness tests. Followed the existing live-session caller and the installed native camera implementation where needed to establish behavior. Two defects were initially verified and then fixed: lifecycle teardown reopened the camera in an active workout, and the native startup deadline ended before native model/camera initialization. The narrow recheck below verified both fixes; no original findings remain open. Historical findings and evidence are retained for traceability.

Scope excludes unrelated pre-existing checkout changes. Disabled calibration flags and pending physical-device evidence are intentional phase constraints, not findings. No source files were edited and no commits were created.

## Narrative Findings (AI reviewer)

**Fix recheck — 2026-10-20T16:38:18Z:** Re-read the two changed production paths and the added runtime regressions. `rtk proxy node --test mobile/camera-readiness.test.mjs frontend/tests/camera-readiness.test.mjs` passed **23/23**, zero failures/skips. The added cases exercise the actual hook/component with controlled browser/native boundaries. No app edits, build or browser run were performed by this reviewer during the recheck.

## Critical Issues

### CR-01: Lifecycle teardown immediately restarts the live-session camera

**Classification:** BLOCKER
**Disposition:** RESOLVED on 2026-10-20T16:38:18Z. Lifecycle handlers now call `stop(true)`; an idle native status received while native ownership is active also clears auto-start intent. The runtime regression covers blur, hidden document and native idle, verifies no automatic replacement acquisition, and preserves ordinary stop intent plus explicit restart.
**File:** `C:/Users/MY PC/Desktop/Projects/PhysiqueQuest/frontend/hooks/useCameraStream.ts:226-227`
**Related caller:** `C:/Users/MY PC/Desktop/Projects/PhysiqueQuest/frontend/sections/Coach/LiveSession.tsx:108-111`

**Issue:** The new blur/hidden handlers call `stop()` with its default `resetAutoStart=false`. This releases the current camera but leaves the module's `cameraWasEnabled` flag true and publishes `status='idle'`. The existing active, unpaused live-session effect then sees `shouldAutoStart && status==='idle'` and immediately calls `start()` again. Neither `start()` nor that effect checks document visibility/focus. Consequently a tab/window losing focus can reacquire its camera while still unfocused, defeating the new lifecycle teardown requirement. The same caller can react to a native host's lifecycle-generated idle status.

**Evidence:** Executed the actual production hook through installed TypeScript transpilation in a Node VM with minimal React/browser boundaries, then applied the existing caller's condition. Observed `on / shouldAutoStart=true / acquisitions=1`; dispatched the registered blur handler and observed `idle / shouldAutoStart=true / stopped=1`; applied the existing live-session effect and observed `on / acquisitions=2`. Camera-check-only blur tests cannot detect this cross-caller regression.

**Fix:** Make lifecycle suspension suppress automatic acquisition until an explicit restart or a deliberate foreground transition. A small fix is to clear auto-start intent for lifecycle stops, including lifecycle idle messages from the native host; alternatively maintain a suspension flag that both `start()` and live-session auto-start respect. Keep ordinary navigation/pause semantics deliberate. Add a focused regression that starts an active live session, loses focus or becomes hidden, and asserts no replacement acquisition occurs until the permitted recovery action.

## Warnings

### WR-01: Native initialization timeout covers only asset download

**Classification:** WARNING
**Disposition:** RESOLVED on 2026-10-20T16:38:18Z. The startup timer now survives asset resolution and is cleared by successful configuration, terminal deactivation or effect cleanup. The runtime regression verifies a silent native setup times out after the asset resolves, all completion paths clear the timer, and late configuration/landmark callbacks cannot revive failed or disposed startup. Current implementation: `mobile/NativeTrackingCamera.tsx:77-104`.
**File:** `C:/Users/MY PC/Desktop/Projects/PhysiqueQuest/mobile/NativeTrackingCamera.tsx:82-87`
**Related UI:** `C:/Users/MY PC/Desktop/Projects/PhysiqueQuest/frontend/sections/Coach/CameraCheck.tsx:70-72` and `:110`

**Issue:** The startup deadline is cleared as soon as the local model asset resolves. At that point `PoseCamera` has not yet mounted; the installed native camera subsequently opens the pose model, configures capture and eventually emits `onCameraConfigured`. If that native setup stalls or never delivers either configured/error, there is no remaining timeout. The web camera status stays `starting`, Enable camera stays disabled and Retry camera checks is absent indefinitely. Manual continuation remains usable, but retrying requires leaving/reopening the screen. This misses the intended bounded native initialization behavior.

**Evidence:** Executed the production component with a successfully resolving asset and withheld native configured/error callbacks. Before asset completion there was one initialization deadline; afterward the rendered view was `PoseCamera` with `isActive=true` and zero remaining deadlines. Installed `expo-mediapipe-pose` starts its actual detector in `ExpoMediaPipePoseView` after receiving `poseModelAssetPath`; asset availability is not native initialization completion.

**Fix:** Keep the current-job startup deadline alive until `onCameraConfigured`, and clear it on configuration, terminal failure and effect cleanup. If it expires after asset delivery, fail and unmount the same current camera job. Add a regression where asset download succeeds but native configured/error never arrives, asserting a bounded actionable failure and obsolete-callback rejection.

## Review Evidence and Limits

- Initial review: `rtk proxy node --test mobile/camera-readiness.test.mjs frontend/tests/camera-readiness.test.mjs`: 21 passed, zero failures/skips. That initial test revision did not cover the two scenarios above. Fix recheck: 23 passed, including both added runtime regressions.
- Inspected the existing browser readiness fixture for lifecycle, worker/bitmap ownership, independent connection evidence, explicit upload behavior, status announcements and manual continuation.
- Used two small Node VM reproductions against production source for the reported findings; no source or test files were created for those probes.
- No new browser server/build was started during this review. No physical-device execution, calibration or native runtime accuracy claim is made.

---

_Reviewed: 2026-10-20T16:35:06Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
