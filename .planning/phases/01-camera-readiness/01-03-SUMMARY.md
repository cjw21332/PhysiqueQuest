---
phase: 01-camera-readiness
plan: "03"
subsystem: testing
tags: [readiness, privacy, calibration, regression, device-checkpoint]
status: checkpoint
tasks-complete: 1
tasks-total: 2
checkpoint: 01-03-02
gate: blocking-human
requires: [01-01, 01-02]
provides:
  - Fresh software privacy/manual/upload/provider/rep/workout regression evidence
  - Versioned pending 45-row calibration matrix and test-local provenance guard
affects: [device-calibration, phase-01-sign-off]
tech-stack:
  added: []
  patterns: [pending physical evidence, policy-to-trial provenance]
key-files:
  created:
    - frontend/tests/camera-readiness-calibration.test.mjs
    - .planning/phases/01-camera-readiness/01-CALIBRATION.json
  modified:
    - frontend/tests/browser/camera-readiness.spec.mjs
    - .planning/phases/01-camera-readiness/01-VALIDATION.md
key-decisions:
  - Keep every unsupported calibration flag false until actual physical trials support it.
  - Shared native flags require both Android and iOS evidence because current policy has no per-OS flag.
requirements-scope: Software evidence only; READY-10/12 physical-device backstops and phase completion remain pending.
actuals:
  tokens: 6538
  tasks: 1
  commits: 0
plan_head_before: e4a54d02a264083e4a3c0e4bf40935237755a4be
plan_head_after: e4a54d02a264083e4a3c0e4bf40935237755a4be
checkpoint-date: 2026-10-21
duration: Not separately instrumented; actual command runtimes recorded below.
---

# Phase 1 Plan 3: Software Regression and Pending Device Calibration

**Live readiness privacy, manual workout continuation and explicit upload/provider contracts pass fresh regressions; 45 physical-device trials remain pending behind a blocking checkpoint.**

## Task Status

| Task | Status | Commit | Evidence |
|---|---|---|---|
| 01-03-01 — Verify privacy, manual continuation and unchanged workout/upload behavior | Complete | None, explicitly prohibited | Final Node 63/63, backend 3/3, mobile TS, production build and browser 30/30 |
| 01-03-02 — Calibrate on actual devices | Awaiting physical observations; blocking-human | None | All 45 trials and six calibration decisions pending; no actual target device/build established |

This is a checkpoint summary, not a completed-plan marker. Phase/requirements state and final approval are owned by the orchestrator and were not advanced by this executor.

## Changes and Evidence

- Added six browser `readiness regression` cases. Live enable/retry/reopen produces no outgoing non-GET request or readiness storage key. Denied, unsupported, model-failure and stale paths continue through the actual workout-create UI using selected exercise IDs/prescriptions and release media tracks. Explicit upload rejects wrong MIME type and over-20MB video before any analysis POST. Existing explicit upload payload, hidden rep-link, library, provider-parser, form-score unavailable and counter tests remain intact.
- Added schema-version-1 calibration evidence: three untested surfaces, 15 cases per surface, six pending decisions, provisional threshold proposals and null observations/false-green/notes. No images, videos, raw landmarks, identity or credentials were collected. All six production calibration flags remain false; brightness bands remain unset.
- Added four Node evidence tests. The test-local guard checks full matrix coverage, device/build metadata for claimed observations, no media fields, invalid ranges, false-green claims, matching calibrated numeric values and supporting trial IDs. A calibrated native flag requires Android and iOS support. A synthetic validator-only positive fixture exercises guard acceptance without writing invented physical results.
- Final regression includes the two lifecycle fixes made by the native executor during independent review: background/blur cannot trigger idle LiveSession camera auto-restart, and native startup timeout remains active after asset resolution until camera configuration. This executor did not edit those production files.

## Fresh Final Verification — October 21, 2026

Commands ran from repository root through RTK, in plan order, after both review fixes. Every command exited 0; required test skips: 0.

| Command | Result |
|---|---|
| `rtk proxy node --test frontend/tests/camera-readiness.test.mjs frontend/tests/camera-readiness-calibration.test.mjs frontend/tests/device-readiness.test.mjs frontend/tests/pose-flow.test.mjs frontend/tests/mobile-redesign.test.mjs frontend/tests/rep-counter.test.mjs frontend/tests/workout-flow.test.mjs frontend/tests/workout-routine.test.mjs mobile/camera-readiness.test.mjs mobile/accessibility.test.mjs` | **63/63**, 1144ms runner / 1.36s command |
| `rtk npm --prefix backend test -- test/pose-analysis.spec.ts` | **3/3**, 515ms runner / 1.54s command; mocked provider |
| `rtk proxy node node_modules/typescript/bin/tsc --project mobile/tsconfig.json --noEmit` | **PASS**, 2.52s |
| `rtk npm --prefix frontend run build` | **PASS**, 6.71s; 17 routes |
| `rtk proxy node node_modules/@playwright/test/cli.js test --config frontend/playwright.tracking.config.mjs frontend/tests/browser/camera-readiness.spec.mjs frontend/tests/browser/pose-tracking.spec.mjs --workers=1` | **30/30**, reported 1.0min; 28 readiness + 2 existing tracking/library cases |
| `rtk git diff --check` | **PASS** before final documentation; repeated in self-check |

The first guard run failed 3/3 on the intentionally missing calibration record, then passed after that record was added. The first full browser run passed 29/30; its only failure was an ambiguous test `role=alert` locator also selecting the Next route announcer. After scoping the fixture selector, the focused invalid-upload test passed 1/1 (5.8s); final full browser run passed 30/30. Those earlier results are not substituted for the fresh final run. Existing Vite tsconfig-paths and FORCE_COLOR notices did not affect exits and were not changed.

Browser fake capture and synthetic native bridge events verify software behavior. Node native tests execute callbacks with mocked boundaries. Typechecks/builds do not establish hardware support, camera accuracy, thermal behavior or OS accessibility.

## Blocking Device Checkpoint

**Blocked by:** No actual target camera observations or current Android/iOS native development build/device established. No `adb`, `xcrun` or `xcodebuild` resolved on PATH; conventional Android adb path and native generated project/build-config directories are absent. No native build/install/toolchain setup was attempted. Expo Go can test fallback but cannot validate the custom native pose path.

`01-VALIDATION.md` contains the exact matrix and reproducible UI steps. All 15 case IDs remain pending on each of web, Android and iOS:

`front-back`, `orientation`, `cover-crop-mirror`, `entry-exit-clipping`, `body-diversity`, `side-bent-occlusion`, `lighting-cover`, `permissions-busy`, `background-lock`, `switch-exit-reopen`, `model-worker-failure`, `slow-thermal`, `screen-reader`, `font-scale-targets`, `manual-continuation`.

An existing web server responded HTTP 200 at `http://localhost:3000/coach`. On an actual supported camera browser, log in to a test account and open Coach → Start session → Camera check. Actual Android/iOS testing needs a development build containing the installed `expo-mediapipe-pose` 0.3.0 and this checkout's current code; provide the device/build so Codex can prepare available tooling. On each surface perform both lenses, rotation/crop/mirror/clipping, body/lighting cases, lifecycle/error/thermal and accessibility/manual cases listed in VALIDATION. Record device/OS/build revision/capability and scalar status, false greens, latency/heat/cleanup/accessibility notes under each trial ID. Supply no media, raw landmarks, identity or credentials.

After observations are supplied, the executor applies supported numeric policy decisions, references actual trial IDs and reruns Task 01-03-02's Node/build/readiness-browser checks. Leave unsupported checks Unavailable and missing hardware rows pending. Human approval cannot convert an untested row into a pass. Neither Task 2 nor Plan 03 nor Phase 1 is complete.

## Deviations and Ownership

- User/orchestrator explicitly prohibited commits, branches, worktrees, pushes and installs. No staging/reset/stash/clean occurred. Zero commits and unchanged HEAD are intentional; the normal atomic-commit workflow is superseded by that instruction.
- Existing modified/untracked source and tests were preserved. This plan added its evidence/guard and appended browser cases; it did not rewrite prior provider/rep/workout tests or enable thresholds. Root owns STATE/ROADMAP/requirements, checklist, rule docs and progress reports. The checklist was reviewed; it must retain device/live-service limits.
- Rule 1: corrected the new browser fixture's ambiguous alert locator after its recorded failure. No production workaround was needed.
- Threat T-01-08: scalar-only evidence with no media/private fields. T-01-09: version/provenance/range guard plus pending records and an unresolved physical checkpoint. No new production endpoint/auth/schema/file-access surface was introduced. No implementation stubs were added; null hardware observations are intentional unperformed trials.
- `actuals.tokens` is ceil(chars/4) for this plan's new guard (8700 chars), JSON (13134 chars) and appended browser regression block (4315 chars), totaling 6538. It excludes earlier shared-checkout work and planning prose, and is a bounded source/evidence size metric, not runtime model usage. No isolated task baseline exists. Total task wall time was not separately instrumented.

## Self-Check: PASSED

All four owned evidence/test files and this checkpoint summary exist. The final required software commands passed with zero skips; final whitespace check passed. HEAD remains the recorded value; commits are deliberately absent. Physical-device evidence is explicitly pending, all six flags remain false, and overall planning state was not advanced.
