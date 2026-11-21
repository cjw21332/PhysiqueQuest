# Patch inventory — incomplete audit

This is an inventory, not an applicable series. Ordering, dependencies and working-tree state remain unresolved.

| Patch | Files named in patch |
| --- | --- |
| 0001-local-video-labels-and-inventory.patch | docs/pose-replay/labels.local.json<br>docs/pose-replay/local-video-inventory.json |
| 0002-browser-free-replay.patch | scripts/pose-replay/counter-bridge.cjs<br>scripts/pose-replay/offline-python.py<br>scripts/pose-replay/OFFLINE-README.md |
| 0003-soak-plan-thermal-latency-endpoints.patch | docs/pose-replay/soak-plan-additions.md |
| 0004-local-resume-evidence.patch | docs/pose-replay/local-resume-report.md<br>docs/pose-replay/replay-environment-log.json |
| 0005-reference-motion-telemetry.patch | shared/movementTelemetry.ts<br>shared/__tests__/movementTelemetry.spec.ts |
| 0006-reference-tracker-overlays.patch | frontend/hooks/useGenericRepTracking.ts<br>frontend/sections/Coach/GenericTrackingSession.tsx<br>frontend/sections/Coach/posetracker.css<br>mobile/PoseTrackerNative.tsx |
| 0007-reference-analysis.patch | docs/pose-replay/reference-approach.md<br>docs/pose-replay/reference-observer-probe.json |
| 0008-provisional-visual-labels.patch | docs/pose-replay/labels.local.json |
| 0009-generic-counter-candidate.patch | shared/genericRepCounter.ts |
| 0009-provisional-baseline-evidence.patch | scripts/pose-replay/build-visual-review-pack.py<br>scripts/pose-replay/pixel-crosscheck.py<br>scripts/pose-replay/run-provisional-baseline.py<br>scripts/pose-replay/summarize-provisional-baseline.py<br>scripts/pose-replay/visual-contact-sheets.py<br>docs/pose-replay/labels.freeze.json<br>docs/pose-replay/visual-spot-checks.md<br>docs/pose-replay/provisional-baseline-report.md<br>docs/pose-replay/provisional-baseline.json<br>docs/pose-replay/baseline-table.csv<br>docs/pose-replay/baseline-event-evidence.json<br>docs/pose-replay/baseline-latency-windows.json<br>docs/pose-replay/pixel-crosscheck-summary.json |
| 0010-generic-timing-candidate.patch | shared/genericRepCounter.ts |
| 0011-subject-selection-scenarios.patch | shared/__tests__/poseSubject.scenarios.spec.ts |
| 0012-timing-rejection.patch | shared/exerciseEngine.ts<br>shared/__tests__/exerciseEngine.spec.ts |
| 0013-tracking-availability-wording.patch | frontend/sections/Coach/PoseTrackerSession.tsx<br>backend/src/pose-tracker/exercise-registry.ts<br>patches/PROGRESS.md<br>shared/__tests__/trackingAvailability.spec.ts |
| 0014-camera-exercise-lifecycle.patch | frontend/hooks/useCameraStream.ts<br>mobile/camera-readiness.test.mjs<br>patches/PROGRESS.md<br>patches/A2-camera-lifecycle-audit.md |
| 0015-camera-recovery-state.patch | shared/cameraRecovery.ts<br>shared/__tests__/cameraRecovery.spec.ts |
| 0016-browser-recovery.patch | frontend/hooks/useCameraStream.ts<br>frontend/sections/Coach/GenericTrackingSession.tsx<br>frontend/sections/Coach/LiveSession.tsx<br>frontend/sections/Coach/TrackingSession.tsx<br>frontend/sections/Coach/SquatFormPreview.tsx<br>frontend/hooks/useGenericRepTracking.ts<br>mobile/camera-readiness.test.mjs |
| 0017-native-recovery.patch | mobile/PoseTrackerNative.tsx<br>mobile/NativeTrackingCamera.tsx |
| 0018-host-message-recovery.patch | mobile/App.tsx |
| 0019-recovery-integration-tests.patch | mobile/camera-readiness.test.mjs |
| 0020-a3-evidence-and-apply.patch | patches/PROGRESS.md<br>patches/A3-camera-recovery-report.md<br>patches/apply-all.ps1 |

Rejected drafts are in `drafts/`. Both 0009 prefixes are distinct. 0008 modifies the label file created by 0001. The archived base accepts 0001–0005 but not 0006, which was generated against a different dirty workspace. The 0010 timing candidate was rejected and must not be included in an accepted application sequence.
