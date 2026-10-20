---
phase: 01-camera-readiness
plan: "02"
subsystem: ui
tags: [expo, native-camera, readiness, bridge, privacy, playwright]
requires: [01-01]
provides:
  - Discriminated native readiness mode with full compact observations and preserved rep events
  - Session-scoped bounded native bridge receiver using the shared readiness controller
  - Actual native callback and host validation regressions plus synthetic WebView browser coverage
affects: [01-03, native-camera-readiness, calibration]
tech-stack:
  added: []
  patterns: [captured callback identity, ephemeral React state, bounded local inference, fixed bridge events]
key-files:
  created: [mobile/camera-readiness.test.mjs]
  modified:
    - mobile/App.tsx
    - mobile/NativeTrackingCamera.tsx
    - frontend/hooks/useCameraStream.ts
    - frontend/hooks/useCameraReadiness.ts
    - shared/cameraReadiness.ts
    - frontend/tests/browser/camera-readiness.spec.mjs
    - frontend/tests/mobile-redesign.test.mjs
key-decisions:
  - Native observations omit foreign-clock freshness timestamps; the web receiver stamps monotonic receipt time.
  - Terminal capability/error/interruption remains latched until a replacement readiness session.
  - Native inference starts at at most 5Hz and slows to 2.5Hz for serious thermal state or slow inference; critical thermal state stops the camera with an explicit warm-phone explanation.
  - All body, lighting and framing calibration flags remain false; physical-device checks belong to plan 01-03.
requirements-completed: [READY-01, READY-02, READY-03, READY-04, READY-05, READY-06, READY-07, READY-08, READY-09, READY-10]
requirements-scope: Native software implementation and synthetic callback/bridge evidence only; physical-device verification remains pending.
coverage:
  - deliverable: Native readiness observations traverse the session-scoped bridge and shared evaluator independently of rep kind/side.
    verification:
      - {kind: test, ref: 'mobile/camera-readiness.test.mjs', status: pass}
      - {kind: test, ref: 'frontend/tests/browser/camera-readiness.spec.mjs#native tracer', status: pass}
    human_judgment: false
  - deliverable: Invalid/stale callbacks, lifecycle loss, unavailable modules, model failures and thermal limits fail safely in software.
    verification:
      - {kind: test, ref: 'mobile/camera-readiness.test.mjs', status: pass}
      - {kind: test, ref: 'frontend/tests/browser/camera-readiness.spec.mjs#native lifecycle', status: pass}
    human_judgment: false
  - deliverable: Native preview geometry, mirroring, thermal behavior and accessibility on target devices.
    human_judgment: true
    rationale: No Android/iOS physical camera or native development build was exercised; calibration remains disabled.
actuals:
  tokens: 18764
  tasks: 2
  commits: 0
plan_head_before: e4a54d02a264083e4a3c0e4bf40935237755a4be
plan_head_after: e4a54d02a264083e4a3c0e4bf40935237755a4be
duration: approximately 15min
completed: 2026-10-21
status: complete
---

# Phase 1 Plan 2: Native Readiness Bridge Summary

**One native pose preview produces bounded full-landmark/brightness observations for the existing shared evaluator, while independent three-joint rep events and manual workouts retain their contracts.**

## Accomplishments

1. Added `NativeReadinessOptions` independently of tracking kind/side. Camera-check selects the existing local pose camera when available; ordinary `CameraView` remains the mutually exclusive fallback. Native normalization retains up to 33 x/y/confidence landmarks, scalar luminance, advancing frame identity and actual source/preview geometry. Installed coordinates are already upright/mirrored, so source and preview mirroring match without applying a second mirror. Existing rep events still contain requestId, side and three selected joints.
2. Added a fixed `physiquequest-camera-readiness` bridge event using JSON serialization and less-than escaping. Context/session/geometry/status values are bounded and validated. The receiver stamps receipt time locally, rejects malformed/future/nonfinite/oversized messages, and ignores wrong sessions, geometry and duplicate sequences. Fresh zero-person observations can establish camera connection; configuration and capability messages cannot. Native overlay copy is mapped locally from validated framing status/reason enums.
3. Captured callback job identities rather than reading replacement session options. Stop/switch/geometry changes, AppState background/Android blur, screen exit, WebView reload/error/process death, model/inference failure and critical thermal pause invalidate obsolete work. Cameras/listeners/model promises are released or ignored; model loading has a 10-second deadline. Native readiness inference/callbacks start at 5Hz, slow to 2.5Hz for serious thermal/slow inference and stop at critical thermal state. Recovery requires a new session and fresh dwell.
4. Removed the unused readiness still-photo request/reply and capture helper after searching all callers. No readiness photo polling, frame upload, media persistence, new endpoint, dependency or state library was introduced. Expo Go/missing native modules retain ordinary preview with unsupported checks and camera-off/manual continuation. Explicit selected-video analysis is unchanged.

## Red-First Evidence and Corrections

- The new synthetic native tracer ran against the existing production screen and failed **1/1** in 708ms because `camera-start.previewContext.readiness.sessionId` was absent. This was a behavior failure with a working page/server. After integration it passed **1/1** (4.0s), then passed the tracer gate repeat **1/1** (4.1s) before task 2 expansion.
- Actual callback/receiver tests initially ran **18/20**. They exposed a terminal interrupted session being revived by a later pending reset, plus an overly broad luminance-validator change that broke the existing browser independence test. The receiver now latches terminal failure; strict luminance validation is scoped to the native boundary. The focused suite then passed **20/20** and, after host-validation coverage, **21/21**.
- Expanded regression initially passed **51/52** because the old mobile-redesign source assertion still required `camera-capture-readiness`/`takePictureAsync`. The orchestrator authorized the scoped test update to assert their absence and the new validated readiness bridge. Targeted mobile-redesign then passed **22/22**, and the combined suite passed **52/52**.

## Verification Results

All commands ran from repository root through RTK. No required tests were skipped.

| Command | Final evidence |
|---|---|
| `rtk proxy node --test mobile/camera-readiness.test.mjs frontend/tests/camera-readiness.test.mjs` | PASS, 21/21, 939ms; includes 11 native tests executing production callbacks/normalization, component async/listener boundaries, receiver and host validators |
| `rtk proxy node node_modules/typescript/bin/tsc --project mobile/tsconfig.json --noEmit` | PASS, 2.37s after final production changes |
| `rtk npm --prefix frontend run build` | PASS, 9.64s after final production changes, 17 production routes |
| `rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --grep "native tracer" --workers=1` | PASS, 1/1; gate rerun also passed; tracer passes again in final complete suite |
| `rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --grep "native lifecycle" --workers=1` | PASS, 6/6, 15.7s; all six pass again in final complete suite |
| `rtk proxy node --test mobile/camera-readiness.test.mjs frontend/tests/camera-readiness.test.mjs frontend/tests/rep-counter.test.mjs mobile/accessibility.test.mjs frontend/tests/mobile-redesign.test.mjs frontend/tests/pose-flow.test.mjs` | PASS, 52/52, final 1.11s |
| `rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --workers=1` | PASS, 22/22, final 1.1min after final changes; preceding complete run also passed 22/22 in 54.0s |
| `rtk git diff --check` | PASS |

Node tests cover full compact metadata, zero-person observations, confidence absence, cover/mirroring, foreign clocks, future/nonfinite/oversized/invalid messages, duplicate sequences, terminal reset latching, current-job guards, facing/lens/zoom/source geometry, throttling/critical pause, unavailable modules, model failure, background/blur, listener removal, late model promises, script escaping and existing rep event shape. Browser bridge tests use a synthetic `ReactNativeWebView`; they establish software behavior, never physical phone execution. Existing web worker/cleanup/UX/upload checks all continue to pass.

## Threat Mitigations

- **T-01-04:** bounded message length before JSON parsing, session length <=100, geometry/dimension/frame/confidence validation, fixed envelope types, validated status/reason and receiver sequence rejection.
- **T-01-05:** captured job/session identity, per-document session owner plus monotonic generations, instance guards, lifecycle invalidation, disposed callbacks and late-promise cleanup.
- **T-01-06:** compact scalar/landmark observations only; fixed escaped event name; removed still-photo bridge; no camera media logging/storage/upload.
- **T-01-07:** mutually exclusive preview branches, bounded inference/callback rate, loading deadline, thermal pause, deactivation and listener cleanup.
- **T-01-SC:** no installs, dependencies or package substitutions.

No new endpoint/auth/schema/file-access trust surface was introduced beyond the native/WebView boundaries already enumerated in the plan. Stub scan found no unresolved implementation stubs; the existing connection URL input placeholder is ordinary input guidance. Disabled calibration flags are intentional truthfulness controls.

## Decisions and Deviations

- Repository authorization forbids commits/pushes/branch/worktree changes. Tasks and summary remain reviewable in the shared checkout; zero commits is intentional. HEAD is unchanged. STATE/ROADMAP/requirements/checklist/progress and overall phase completion remain owned by the orchestrator. Plan 01-02 rows alone are updated in VALIDATION.
- **Rule 1:** latched terminal receiver failure and preserved existing independent browser brightness behavior after regression failures described above.
- **Rule 2:** per-document session owner prevents ID reuse after document reload; repeated native camera configuration cannot publish a success after invalidation; model initialization is deadline-bounded.
- **Rule 3:** updated the stale mobile-redesign capture assertions with explicit orchestrator authorization; no unrelated assertions changed.
- Runtime tests reuse installed TypeScript transpilation, Node VM and injected Expo/React Native boundaries; no React/native test framework was added.
- `actuals.tokens` is chars/4 of selected tracked diffs plus the new native test and native-only portions of shared/hook/browser files. Existing shared-checkout tracked App/stream hunks are included in this bounded source-size estimate; no isolated pre-plan baseline was available, so it is not claimed as a precise task-only diff or runtime token count.

## Remaining Device Evidence

No physical Android/iOS camera, native development build, Expo export, real crop/orientation/front/back mirroring, thermal/battery behavior, permission UI, VoiceOver/TalkBack or system-text scaling was exercised here. Those checks remain pending in plan 01-03. All browser/native body, lighting and framing calibration flags remain false and brightness bands remain unset. There are no measured-distance, lux, accuracy or physical-device success claims.

Ready for plan 01-03 software audit and its blocking physical-device checkpoint; the phase is not complete.

## Self-Check: PASSED

All eight implementation/test files and this summary exist. Required focused and combined Node, mobile TypeScript, production build and browser checks passed with zero required skips; final diff whitespace check passed. HEAD remains the value recorded above. No commit check applies because commits were explicitly prohibited. Checklist was reviewed; its updates and phase state remain with the orchestrator.
