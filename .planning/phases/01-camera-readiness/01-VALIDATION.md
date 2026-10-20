---
phase: "1"
slug: "camera-readiness"
status: checkpoint
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-20"
---

# Phase 1 — Validation Strategy

## Test Infrastructure

Reuse Node built-in frontend/mobile tests, Playwright browser checks and backend Vitest. No framework installation. Three plans contain seven tasks in sequential waves 1 → 2 → 3. Software execution results are recorded below. Physical-device calibration and the blocking human checkpoint remain pending; software passes do not establish device accuracy.

Quick existing baseline from repository root: `rtk proxy node --test frontend/tests/device-readiness.test.mjs frontend/tests/pose-flow.test.mjs`.

Commands below assume repository root. The frontend build script, backend `test` script (`vitest run`), mobile tsconfig and installed TypeScript/Playwright CLI paths were checked. Mobile has no package test/typecheck script, so use direct Node/TypeScript commands. Build before Playwright: the existing tracking config starts the production server on port 3221. Non-zero exit, zero selected tests or skipped required tests is failure. Commands are non-watch; record actual runtimes during execution.

## Sampling Rate

Run focused tests after each behavior change; run affected suites after each plan wave. Do not defer all tests until the end. No three consecutive tasks may lack automated verification. Record actual runtime rather than inventing timing guarantees.

## Per-Task Verification Map

Each row uses the exact commands from its task. Run commands in the listed order and fail the task if any fails; a later command cannot erase an earlier failure. In every task's `<verify>`, each runnable command has its own `<automated>` element immediately followed by its own `<fails_when>` sibling. Builds/typechecks fail on nonzero exit; test commands also fail zero executed/selected tests, skipped required cases or the stated assertion signals.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|---|---|
| 01-01-01 | 01 | 1 | READY-01/03/07/08/09 | browser tracer | `rtk npm --prefix frontend run build`<br>`rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --grep "web tracer" --workers=1` | Browser fixture exists; real bundled worker/model exercised | PASS 2026-10-21: build 6.89s; tracer 1/1 (4.2s); final combined browser rerun 14/14 (33.1s). No hardware claim. |
| 01-01-02 | 01 | 1 | READY-01/02/03/04/05/06 | unit/browser lifecycle | `rtk proxy node --test frontend/tests/camera-readiness.test.mjs`<br>`rtk npm --prefix frontend run build`<br>`rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --grep "web lifecycle" --workers=1` | Unit and browser fixtures exist | PASS 2026-10-21: unit 10/10 (350ms), lifecycle 8/8 (23.5s); all eight re-passed in final 14/14 browser run (33.1s), final build 6.89s. Calibration flags remain false. |
| 01-01-03 | 01 | 1 | READY-03/04/08/09/10 | UX/regression | `rtk proxy node --test frontend/tests/camera-readiness.test.mjs frontend/tests/mobile-redesign.test.mjs frontend/tests/pose-flow.test.mjs`<br>`rtk npm --prefix frontend run build`<br>`rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --grep "readiness UX" --workers=1` | Existing regressions updated; readiness fixtures exist | PASS 2026-10-21: Node 33/33 (414ms), UX 5/5 (18.1s); all five re-passed in final browser 14/14 (33.1s), final build 6.89s. Native accessibility/device evidence pending. |
| 01-02-01 | 02 | 2 | READY-01/02/03/04/07/08/09/10 | bridge/browser tracer/typecheck | `rtk proxy node node_modules/typescript/bin/tsc --project mobile/tsconfig.json --noEmit`<br>`rtk npm --prefix frontend run build`<br>`rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --grep "native tracer" --workers=1` | Existing compiler/config; native bridge fixture implemented | PASS 2026-10-21: TS 2.37s; final build 9.64s; tracer 1/1 (4.0s) and gate repeat 1/1 (4.1s). Final readiness browser suite 22/22 (1.1min). Synthetic bridge only; no phone claim. |
| 01-02-02 | 02 | 2 | READY-05/06/07/08/09 | native callback/bridge/lifecycle | `rtk proxy node --test mobile/camera-readiness.test.mjs frontend/tests/camera-readiness.test.mjs`<br>`rtk proxy node node_modules/typescript/bin/tsc --project mobile/tsconfig.json --noEmit`<br>`rtk npm --prefix frontend run build`<br>`rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --grep "native lifecycle" --workers=1` | Native runtime callback/host fixture and lifecycle bridge tests implemented | PASS 2026-10-21: focused Node 21/21 (939ms), expanded regression 52/52 (1.11s), TS/build passed; lifecycle 6/6 (15.7s), all six re-passed in final 22/22 browser run (1.1min). Calibration flags remain false; native hardware/build evidence pending. |
| 01-03-01 | 03 | 3 | READY-07/09/10/11/12 | regression/privacy/evidence | `rtk proxy node --test frontend/tests/camera-readiness.test.mjs frontend/tests/camera-readiness-calibration.test.mjs frontend/tests/device-readiness.test.mjs frontend/tests/pose-flow.test.mjs frontend/tests/mobile-redesign.test.mjs frontend/tests/rep-counter.test.mjs frontend/tests/workout-flow.test.mjs frontend/tests/workout-routine.test.mjs mobile/camera-readiness.test.mjs mobile/accessibility.test.mjs`<br>`rtk npm --prefix backend test -- test/pose-analysis.spec.ts`<br>`rtk proxy node node_modules/typescript/bin/tsc --project mobile/tsconfig.json --noEmit`<br>`rtk npm --prefix frontend run build`<br>`rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs frontend/tests/browser/pose-tracking.spec.mjs --workers=1` | All fixtures and pending calibration JSON exist; current-workspace routine/accessibility inputs retained | PASS 2026-10-21 after lifecycle review fixes: Node 63/63 (1144ms); backend 3/3 (515ms runner); TS 2.52s; build 6.71s; browser 30/30 (reported 1.0min), all exit 0, zero skips. Hardware remains pending. |
| 01-03-02 | 03 | 3 | READY-10/12 | calibration guard + blocking device checkpoint | `rtk proxy node --test frontend/tests/camera-readiness.test.mjs frontend/tests/camera-readiness-calibration.test.mjs mobile/camera-readiness.test.mjs`<br>`rtk npm --prefix frontend run build`<br>`rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs --workers=1` | Earlier fixtures and calibration record; actual hardware/build unestablished | Pending human/device evidence; automated pass cannot approve |

### Failure direction and threat references

Plan 01-01 scoped follow-up: forced pre-transfer `Worker.postMessage` failure reproduced an unclosed bitmap, then passed after explicit finally-based ownership cleanup. Latest build passed in 7.24s; focused transfer-failure and existing pending-bitmap teardown tests passed 2/2 in 6.2s. The earlier full browser run remains 14/14; the fixture now has 15 tests, with the added test verified through this targeted run.

| Task | Explicit failure direction | Threat Ref |
|---|---|---|
| 01-01-01 | Local inference bypassed, body-dependent connection, readiness media request or no executed tracer | T-01-01/02/03 |
| 01-01-02 | Invalid/cropped/uncertain body passes, duplicate/stale evidence sustains green, old session publishes or cleanup fails | T-01-01/03 |
| 01-01-03 | Readiness gates continuation, resources survive stop, labels overstate evidence, target/text/focus/announcement assertions fail | T-01-02/03 |
| 01-02-01 | More than one preview, rep contract drift, media bridge payload, configuration-only connection pass or no executed bridge tracer | T-01-04/06/07 |
| 01-02-02 | Invalid/oversized/old-session payload passes, native clock extends browser freshness, callback identity changes or teardown fails | T-01-04/05/06/07 |
| 01-03-01 | Privacy/provider/rep/workout regression, missing tests, or calibrated/device result without supporting evidence | T-01-08/09 |
| 01-03-02 | Pending human/device evidence, evidence/policy disagreement, unsupported calibrated flag or any software regression | T-01-08/09 |

## Wave 0 Requirements

- Wave 0 is embedded red-first scaffolding, not a separate foundation plan: task 01-01-01 creates `frontend/tests/browser/camera-readiness.spec.mjs` before the real browser tracer; task 01-01-02 creates `frontend/tests/camera-readiness.test.mjs` before geometry/controller expansion.
- Shared synthetic/fake-clock fixtures cover finite/confidence validation, head/feet/bilateral clipping, crop/orientation/mirror, absence/occlusion/bent stance, brightness uncertainty, approximate size, dwell, repeated/out-of-order frame, stale expiry, generation and late results.
- Task 01-02-02 creates `mobile/camera-readiness.test.mjs` for actual normalization/callback logic with mocked platform boundaries and expands browser bridge fixtures. Cover missing module, invalid/oversized payload, escaping, model failure, thermal/resource bounds, teardown and manual continuation.
- Task 01-03-01 creates `frontend/tests/camera-readiness-calibration.test.mjs` and `.planning/phases/01-camera-readiness/01-CALIBRATION.json`; initialize device observations pending, reject false evidence claims, and require calibrated flags to match actual trial IDs/values.
- Reuse existing tests; no dependency additions.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Frame/crop/mirror correctness | READY-02/07/12 | Physical camera geometry | Android and iOS native builds, both lenses, orientation and aspect ratios; step head/feet/hands outside preview |
| Conservative thresholds | READY-03/04/12 | Image exposure/user diversity | Record dim/bright/backlit scenes, clothing/body diversity, side/occluded stance, small/large subject; record false greens and calibration changes |
| Lifecycle/performance/accessibility | READY-06/08/10/12 | Native OS behavior | Lock/unlock, background/notification shade, permissions, thermal/slow hardware, VoiceOver/TalkBack, large text and manual camera-off continuation |

The two UI-SPEC backstops are structured `{statement, verification: backstop}` truths in 01-03-PLAN.md. Native crop/mirroring and native font/accessibility/thermal behavior require actual device evidence before verification. Normal-use calibration flags remain false for unresolved body/framing/brightness checks. Experimental synthetic policy injection is test-only and establishes no hardware accuracy.

Missing hardware evidence remains pending/human-needed, never a synthetic pass.

## Validation Sign-Off

- [x] Final task/command map complete (planning artifact)
- [x] Every task specifies automated verification and explicit failing direction (execution pending)
- [x] New fixtures implemented before dependent tests run
- [x] Existing rep/workout/upload behavior passes regressions
- [ ] Real-device calibration/human checkpoint resolved; missing devices remain explicitly pending
- [x] Planned commands contain no watch mode
- [ ] Execution audit, not this planning run, sets compliance/sign-off

**Approval:** Software checks passed; physical-device calibration and Task 01-03-02 approval remain pending. Nyquist/device sign-off is not granted.

## Plan 01-03 Execution Evidence — October 21, 2026

All final commands above were freshly executed in their listed order after the review fixes for background camera auto-restart and the native startup deadline. The final 63-test suite includes two executable regressions for those fixes, all six rep-counter cases, workout/routine behavior, native accessibility boundaries, and four calibration-record checks. The backend run preserves three provider availability/pass-through cases; it uses a mocked provider and does not establish remote-provider accuracy. TypeScript and build checks passed with no compilation diagnostics. The backend Vite tsconfig-paths advisory and browser FORCE_COLOR advisory are pre-existing tooling notices, not failed checks.

The final browser run used the existing production tracking config sequentially (`--workers=1`), selecting 28 readiness tests and two existing tracking/library regressions. Six new `readiness regression` cases prove live enable/retry and return have no outgoing non-GET requests or readiness persistence keys; denial, unsupported inference, model failure and stale delivery continue through a workout POST with the selected prescription and released tracks; explicit video rejects unsupported type and over-20MB input before analysis. Existing tests verify lazy provider availability, explicit video payload, hidden camera-counting links, no live pose request, native compact bridge payloads, freshness, worker/bitmap teardown and accessible labels/targets. API responses and browser/native camera boundaries are synthetic; these are software observations only.

Initial guard scaffolding intentionally failed 3/3 because the required record did not exist, then passed after the pending record was added. The first full browser run passed 29/30: the new upload test matched both its error alert and Next's route announcer. Scoping it to `.error[role=alert]` fixed the fixture; its focused rerun passed 1/1 (5.8s). The final full run above passed all 30 after that correction and the production review fixes. No required failure was ignored.

`01-CALIBRATION.json` schema version 1 contains 45 pending trial rows (15 each for web, Android and iOS), three untested device slots, six pending calibration decisions, provisional numeric hypotheses and null physical observations. Its four tests reject unsupported schema, private media fields, missing matrix rows, passes on untested hardware, unsupported flags/trial provenance, invalid numeric ranges and policy disagreement. A clearly synthetic in-memory validator fixture tests the valid evidence branch; it is never written as a device observation. All actual web/native full-body, lighting and framing flags remain false, and no lighting band is configured.

### Remaining Device Matrix

Every row below remains **pending on web, Android and iOS**; each has a corresponding trial ID in the JSON record.

| Case ID | Actual observations required on each surface |
|---|---|
| front-back | Both lenses and successful/manual continuation |
| orientation | Portrait, landscape and rotation during capture |
| cover-crop-mirror | Narrow/wide cover crop; visible bounds and single mirroring |
| entry-exit-clipping | Step in/out; crop head, hands and feet individually |
| body-diversity | Short/tall and small/large framing; varied clothing/skin tones without identity data |
| side-bent-occlusion | Side-on, bent and partly occluded bodies never get a false pass/closer claim |
| lighting-cover | Dim, normal, bright, backlit and covered camera; scalar scene estimates only |
| permissions-busy | Denial, revocation and another app holding camera |
| background-lock | App switch, notification shade, lock/unlock; old passes cleared |
| switch-exit-reopen | Rapid lens changes, exit/reopen, fresh session and resource release |
| model-worker-failure | Failed/slow model startup or worker/inference; actionable fallback |
| slow-thermal | Latency/sampling/heat notes, slowdown/thermal pause and usable controls |
| screen-reader | TalkBack/VoiceOver focus, text states and limited announcements |
| font-scale-targets | System scale 1.5+ and 48px/dp targets without clipping |
| manual-continuation | Camera off/denied/unsupported/error paths create a real manual session |

### Checkpoint Setup and Resume

An existing local web server responds at `http://localhost:3000/coach` (HTTP 200 checked); no physical camera was used. Log in with a test account, open Coach → Start session → Camera check. The browser suite started and stopped its own production server on port 3221. It used fake video and a synthetic native WebView bridge, never actual phone cameras.

No `adb`, `xcrun` or `xcodebuild` command resolved on PATH. The conventional `%LOCALAPPDATA%/Android/Sdk/platform-tools/adb.exe` path and `mobile/android`, `mobile/ios`, `mobile/eas.json` are absent. This establishes the limits of the local tooling probe, not absence of all possible hardware. No Android/iOS device, signed build or reachable native development client was established. Expo Go cannot supply the installed custom pose module; actual native observations need a current development build containing `expo-mediapipe-pose` 0.3.0. iOS build tooling requires an appropriate build host or an existing installable development build. No installs or generated native projects were attempted.

Provide actual target devices/builds and scalar observations for the rows above. Record device model, OS, build ID/source revision, capability, trial ID, observed status, false-green yes/no, timing/heat/cleanup/accessibility notes and limitations. Do not supply images, videos, raw landmarks, identity or credentials. Codex prepares available tooling and applies supported policy values; the user performs the physical/UI observations. A human approval alone cannot make an untested row pass. After observations, update supported decisions/trial IDs and rerun Task 01-03-02's guard/build/readiness-browser commands before sign-off. Until then, Plan 01-03 is **1/2 tasks complete**, Phase 1 remains incomplete and all unresolved checks remain unavailable.
