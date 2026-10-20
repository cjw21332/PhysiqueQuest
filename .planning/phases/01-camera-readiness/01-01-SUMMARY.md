---
phase: 01-camera-readiness
plan: "01"
subsystem: ui
tags: [camera, mediapipe, readiness, react, playwright, privacy]
requires: []
provides:
  - Local browser readiness worker and independent decoded-camera delivery evidence
  - Pure bounded whole-body, cover-crop, brightness and framing evaluator/controller
  - Accessible manual continuation, retry and preserved explicit recorded-video analysis
affects: [01-02, 01-03, native-camera-readiness, calibration]
tech-stack:
  added: []
  patterns: [ephemeral React state, generation guards, local worker inference, independent evidence]
key-files:
  created:
    - shared/cameraReadiness.ts
    - frontend/hooks/useCameraReadiness.ts
    - frontend/tests/camera-readiness.test.mjs
    - frontend/tests/browser/camera-readiness.spec.mjs
  modified:
    - frontend/workers/pose.worker.ts
    - frontend/hooks/useCameraStream.ts
    - frontend/sections/Coach/CameraCheck.tsx
    - frontend/app/globals.css
    - frontend/tests/mobile-redesign.test.mjs
    - frontend/tests/pose-flow.test.mjs
key-decisions:
  - Normal-use body, brightness and framing calibration flags remain false on both platforms; lighting bands are unset.
  - Camera connection requires advancing decoded frames independently of model success or pose count.
  - Provider availability is queried only in Upload video mode; only explicit Analyze video sends selected media.
requirements-completed: [READY-01, READY-02, READY-03, READY-04, READY-05, READY-06, READY-08, READY-09, READY-10]
requirements-scope: Browser implementation and automated software evidence only; native integration and physical-device evidence remain in plans 01-02/01-03.
actuals:
  tokens: 14344
  tasks: 3
  commits: 0
plan_head_before: e4a54d02a264083e4a3c0e4bf40935237755a4be
plan_head_after: e4a54d02a264083e4a3c0e4bf40935237755a4be
duration: 16min
completed: 2026-10-21
status: complete
---

# Phase 1 Plan 1: Local Browser Camera Readiness Summary

**Fresh decoded frames drive camera connection independently of real local MediaPipe observations; uncalibrated body, brightness and framing checks stay unavailable.**

## Accomplishments

1. Replaced live JPEG/provider readiness with an ephemeral browser worker path. The real bundled CPU/VIDEO pose model produces separate readiness results with full normalized landmarks, pose count, bitmap dimensions and a weighted 32×32 normalized image-brightness sample. Sampling failure affects brightness evidence only. Existing rep frame commands and three-joint selection remain intact.
2. Added dependency-free observation validation, cover-crop projection, explicit source/preview mirroring, bilateral/head/feet confidence requirements, conservative upright sizing, independent lighting evidence, ready dwell, expiry, monotonic frame identity and generation rejection. Missing/uncertain/bent bodies cannot yield move-closer guidance. Sparse/malformed arrays and invalid finite/range data cannot pass. Synthetic policies exercise the experimental geometry; normal policies enable none of the three unvalidated checks.
3. Added bounded browser acquisition: one bitmap/inference in flight, initial 5Hz sampling with slower inference backoff, 10-second initialization and 5-second in-flight deadlines, advancing video-frame callbacks with decoded-currentTime fallback, and a stale watchdog. Switch/start/stop, geometry changes, track loss, permission/play failure, blur/background and unmount invalidate obsolete work. Late streams and pending bitmaps are released.
4. Retained the existing layout, dark tokens, preview and four rows with explanatory Checking/Ready/Adjust/Unavailable vocabulary, meaningful status icons and one polite stable summary region. Added retry and Continue without camera, kept Start session unrestricted, and stopped camera resources on continuation/navigation/upload. Scoped controls meet 48px targets and wrapping checks. Explicit MP4/MOV validation, selected-video analysis payload/result and object-URL cleanup remain.

## Execution and Red-First Evidence

- Browser tracer was created first and executed against the previous production screen: **1 failed**, in 5.9s, because the new Camera connection row/behavior was absent. The page and existing manual-workout path loaded successfully; this was a behavior failure, not an unavailable browser/server.
- The unit scaffold initially failed with the expected new-module `ENOENT` (581ms). This is recorded as scaffold evidence, not a behavioral RED assertion. Once the module existed, the substantive synthetic cases executed and passed.
- The UX test exposed the inherited 44px Back control before the scoped CSS correction. Height then width assertions failed before the final 48px fix.
- A first build caught that the installed web `NormalizedLandmark` type has no `presence`; worker output now preserves its actual x/y/visibility contract. The shared contract allows optional presence for other adapters and never invents confidence.
- Initial browser fixture issues (Next route-announcer strict selectors and a delayed-acquisition test wrapper) were corrected. A fallback test initially exceeded Playwright's default 5-second assertion while model work settled; its wait is now 15 seconds, with the same production dwell/expiry and decoded-evidence requirements.

## Verification Results

All commands ran from repository root with RTK, no watch mode, no dependency changes and no required skips.

| Command | Final evidence |
|---|---|
| `rtk npm --prefix frontend run build` | PASS, latest 7.24s after bitmap-ownership fix; TypeScript and 17 production routes built |
| `rtk proxy node --test frontend/tests/camera-readiness.test.mjs` | PASS, 10/10, 350ms |
| `rtk proxy node --test frontend/tests/camera-readiness.test.mjs frontend/tests/mobile-redesign.test.mjs frontend/tests/pose-flow.test.mjs` | PASS, 33/33, latest 414ms |
| `rtk proxy node --test frontend/tests/camera-readiness.test.mjs frontend/tests/mobile-redesign.test.mjs frontend/tests/pose-flow.test.mjs frontend/tests/rep-counter.test.mjs` | PASS, 38/38 at the then-nine-test readiness suite, 498ms; all six unchanged rep tests passed |
| `rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --grep "web tracer" --workers=1` | PASS, 1/1, 4.2s; real local worker/model, zero poses accepted, evaluator count advances, no pose API request |
| `rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --grep "web lifecycle" --workers=1` | PASS, 8/8, 23.5s; all eight passed again in the final full run |
| `rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --grep "readiness UX" --workers=1` | PASS, 5/5, 18.1s; all five passed again in the final full run |
| `rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --workers=1` | **PASS, 14/14, 33.1s before the focused bitmap-ownership follow-up below**, zero skips |
| `rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --grep "failed bitmap transfer\|late stream and pending bitmap" --workers=1` | PASS after bitmap-ownership fix, 2/2, 6.2s |
| `rtk git diff --check` | PASS |

The final browser run covers the real worker tracer, crop-resize reset, blur/reopen, muted/ended tracks, rapid switch/off, hidden document, rejected play, currentTime fallback, stale decoded delivery, stopped inference submissions, late acquisition/bitmap release, denied permission, model failure/retry, unsupported capability, camera-off/manual session creation, stable announcements/focus, 48px controls, large-text row overflow and lazy explicit-upload payloads. Experimental Adjust decisions are exercised by synthetic shared tests; browser product policy deliberately keeps calibration-dependent rows unavailable.

The large-text screenshot was inspected at `frontend/test-results/camera-readiness-readiness-c930d--targets-survive-large-text/readiness-large-text.png` during the UX run. Playwright output is ignored runtime evidence and may be replaced by subsequent runs.

## Threat Mitigations

- **T-01-01:** Bounded identity/frame/geometry, array, confidence, finite-number and dimension validation; old-generation results cannot publish; invalid/expired evidence clears affected passes.
- **T-01-02:** Live readiness never calls captureFrame/analyzePose or provider availability. Browser interception verifies zero live pose API calls; explicit selected-video analysis retains exactly its existing mediaBase64/mimeType contract. No readiness persistence is introduced.
- **T-01-03:** Worker bitmap finally-close, one in-flight request, small transient brightness sampling, bounded adaptive rate/deadlines, termination, canceled callbacks/timers, track cleanup and late-acquisition/bitmap assertions.
- **T-01-SC:** No installs, upgrades or packages added.

No new endpoints, authentication, database/schema, persistent media or filesystem access surfaces were introduced.

## Decisions and Deviations

- **Repository authorization takes precedence over commit workflow:** GENERAL forbids commits without explicit permission; the orchestrator explicitly required no commits, branch/worktree changes or pushes. All three tasks and this summary remain reviewable in the shared checkout. No git staging/reset/stash/clean operations occurred. Metadata commits are intentionally omitted, not a failed commit attempt.
- STATE/ROADMAP/requirements and overall phase sign-off were deliberately left to the orchestrator. Only plan 01-01 execution rows were updated in VALIDATION. Root owns checklist/progress-report updates; checklist was reviewed.
- The Next guide path suggested generically was absent; the installed `01-app/01-getting-started/05-server-and-client-components.md` and the exact installed `use-client.md` were read instead. Existing installed MediaPipe signatures were used; no replacement documentation package was installed.
- Production initial-pending grace is timed without manufacturing decoded-frame evidence. Generation-mismatched state is masked immediately during render while obsolete asynchronous work is rejected by the live generation ref.

### Scoped resource-ownership follow-up

The orchestrator requested the identified synchronous `Worker.postMessage` failure path be completed before the native wave. A focused browser test forced `DataCloneError` after bitmap creation and failed red: zero images closed instead of one (7.5s). The hook now retains bitmap ownership until `postMessage` succeeds and closes any still-owned image in `finally`, covering both obsolete acquisition and failed transfer without closing a transferred image twice. Production build passed (7.24s); the new failure test and existing pending-bitmap teardown test passed together (2/2, 6.2s). The fixture now contains 15 tests; the full 15-test fixture was not rerun because this follow-up was explicitly limited to relevant regression checks. The previous full 14-test result remains accurately scoped to the immediately preceding implementation.

## Metrics and Commit Handling

- **Tasks:** 3/3 implemented and verified.
- **Commits:** 0, deliberately prohibited; HEAD remains the recorded value above.
- **Duration:** approximately 16 minutes from first browser fixture creation (`2026-10-20T15:57:30.206Z`) through final verification/summary; initial reading was not separately timed. Completion is October 21 in Asia/Singapore.
- **Actual tokens:** Final measured code/test characters / 4 are recorded in frontmatter. Count includes new files and task-related selected tracked additions/deletions plus only the inserted readiness CSS block; excludes known unrelated pre-existing CSS and auth test changes. This is a change-size metric, not runtime/model token consumption. Shared-checkout baseline is the unchanged HEAD; pre-existing user edits are preserved.

## Remaining Device Evidence

Native integration is next in plan 01-02. Physical Android/iOS/browser cameras, actual crop/orientation/mirroring, exposure/backlight/body diversity, thermal/battery performance and native screen-reader/system-font behavior are unverified. Plan 01-03 owns calibration records and its blocking device checkpoint. Browser fake-camera and synthetic policy passes establish software behavior only.

All web/native body, brightness and framing flags remain false; brightness bands remain unset. These intentional guardrails are not placeholder data. No unresolved implementation stubs were found in the modified production files, and no physical accuracy, lux, measured-distance or subject-lighting claim is made.

## Self-Check: PASSED

All ten declared implementation/test files and this summary exist; final required Node/build/browser checks passed with no skipped required cases; diff whitespace checks passed; HEAD did not change. Planning state and overall phase completion were not advanced by this executor.
