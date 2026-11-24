# PoseTracker Validation Baseline — Repository State

**Generated:** 2026-11-16

## Repository State

- **Branch:** `PhysiqueQuest-v5.1.0`
- **Remote:** `origin/PhysiqueQuest-v5.1.0` (branch up to date)
- **Working tree:** Clean with many pre-existing modifications (see list below)
- **No uncommitted changes** beyond those listed (all modified files were already modified at session start)

## Git Status Summary

```
On branch PhysiqueQuest-v5.1.0
Your branch is up to date with 'origin/PhysiqueQuest-v5.1.0'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  
  Modified files (88 files, PoseTracker-relevant):
    - backend/src/pose-tracker/exercise-registry.ts
    - backend/src/pose-tracker/pose-tracker.module.ts
    - backend/test/pose-tracker.spec.ts
    - frontend/sections/Coach/PoseTrackerSession.tsx
    - frontend/tests/pose-tracker.test.mjs
    - mobile/App.tsx
    - mobile/NativeTrackingCamera.tsx
    - mobile/PoseTrackerNative.tsx
    - mobile/package.json
    - package-lock.json
    - shared/exerciseEngine.ts
    - shared/exerciseTracking.generated.ts
    - shared/videoAnalysisPipeline.ts
    - scripts/generate-exercise-coverage.mjs
    - output/exercisedb-v1-tracking-coverage.json
    - EXERCISEDB_V1_TRACKING_COVERAGE.md
    - EXERCISE_OVERRIDE_AUDIT.md
    - POSETRACKER_ACCURACY_BENCHMARK.md
    - POSETRACKER_ANDROID_SETUP.md
    - POSETRACKER_DEVICE_VALIDATION.md
    - POSETRACKER_FINAL_IMPLEMENTATION_REPORT.md
  
  (Other modified files: foodscan, auth, push, notifications, privacy, profile, progress, workouts, etc.)
  
  Untracked files include:
    - artifacts/ directories
    - output/exercisedb-v1-tracking-coverage.json
    - EXERCISE_OVERRIDE_AUDIT.md
    - POSETRACKER_*.md files
    - ml/reports/ directory with extensive test data
    - mobile/DatasetContributionScreen.tsx
    - Various debug and cache files
```

## Existing Modifications (Pre-existing)

The following PoseTracker-relevant files were already modified before this session:

| File | Description |
|---|---|
| `backend/src/pose-tracker/exercise-registry.ts` | Backend sanitization of native overrides; resolution of generated catalog map |
| `backend/src/pose-tracker/pose-tracker.module.ts` | `launch()` returns `{config, token: null}` for native-pattern exercises |
| `frontend/sections/Coach/PoseTrackerSession.tsx` | Frontend posts `posetracker-native-start` with catalog ID, exercise name, pattern and support label |
| `mobile/App.tsx` | Accepts catalog IDs, pattern field and support enum for `posetracker-native-start` |
| `mobile/NativeTrackingCamera.tsx` | Removed `onProcessFrameLocal`; added `fullLandmarks`; uses `PoseCameraView.onLandmark` |
| `mobile/PoseTrackerNative.tsx` | Rewritten around `NativeTrackingCamera`; every frame feeds `createExerciseCounter(pattern)` |
| `mobile/package.json` | `expo-document-picker ~58.0.5` added for uploaded-video path |
| `shared/exerciseEngine.ts` | Shared deterministic engine; `resolvePatternSpec`, `ExerciseConfigOverride`, `createExerciseCounter` |
| `shared/videoAnalysisPipeline.ts` | `analyzeVideoLandmarks` feeds decoded frames through shared engine with abort signal |
| `scripts/generate-exercise-coverage.mjs` | Generates catalog tracking from `ml/data/exercisedb_catalog.json` |
| `shared/exerciseTracking.generated.ts` | Generated catalog tracking map (1500 exercises) |
| `backend/src/pose-tracker/catalog-tracking.generated.ts` | Backend-generated catalog tracking map |
| `output/exercisedb-v1-tracking-coverage.json` | Full coverage JSON with all 1500 exercise records |
| `EXERCISEDB_V1_TRACKING_COVERAGE.md` | High-level coverage summary with classification rubric |
| `EXERCISE_OVERRIDE_AUDIT.md` | 361 override audit with strong/inferred/uncertain classifications |
| `POSETRACKER_DEVICE_VALIDATION.md` | Status: NOT VERIFIED — no device connected |
| `POSETRACKER_ACCURACY_BENCHMARK.md` | Empty framework schema — no populated records |
| `POSETRACKER_ANDROID_SETUP.md` | Setup prerequisites documented; no device validation occurred |
| `POSETRACKER_FINAL_IMPLEMENTATION_REPORT.md` | Previous implementation report from v5.1.0 development |

## Executed Commands (Baseline Session)

```
$ git status                          → branch, modified/untracked file listing
$ git log --oneline -5               → recent commit history
$ node scripts/generate-exercise-coverage.mjs  → catalog generation
  → 1500 unique IDs, counts: FULLY=0, PARTIAL=831, NOT_YET=127, UNSUPPORTED=542
  → 361 overrides (108 switch to per-side counting)
$ npx vitest run shared/__tests__/exerciseEngine.spec.ts  → 21/21 passed
$ npx vitest run shared/__tests__/videoAnalysisPipeline.spec.ts  → 5/5 passed
$ cd backend && npx vitest run test/pose-tracker.spec.ts  → 24/24 passed
$ node --test frontend/tests/pose-tracker.test.mjs  → 9/9 passed
$ npx tsc -p backend/tsconfig.json --noEmit  (filtered to src/pose-tracker)  → no errors
$ npx tsc -p frontend/tsconfig.json --noEmit  → passed
$ npx tsc -p mobile/tsconfig.json --noEmit  → passed
```

## Catalog Totals (Verified)

| Classification | Exercises | Percentage |
|---|---|---|
| FULLY_SUPPORTED | **0** | 0% |
| PARTIALLY_SUPPORTED | 831 | 55.4% |
| NOT_YET_VALIDATED | 127 | 8.5% |
| UNSUPPORTED | 542 | 36.1% |
| **Total** | **1500** | **100%** |

Per-pattern breakdown (exercise counts):
- horizontal_push: 145, vertical_push: 59, vertical_pull: 60, curl: 143, squat: 74, triceps_extension: 88, hinge: 39, core_flexion: 93, calf_raise: 44, lateral_raise: 24, dip: 21, hip_thrust: 11, core_isometric: 6, jumping_jack: 1, mountain_climber: 1, high_knees: 1, lunge: 36, front_raise: 11

Override totals:
- **361 / 1500** exercises (24.1%) receive a metadata-derived override
- **212 (58.7%)** are Strong — directly supported by a single catalog field
- **96 (26.6%)** are Inferred — require combining signals or contextual reasoning
- **33 (9.1%)** are Uncertain — metadata signal is weak or ambiguous; manual review required
- **96 exercises** flagged as requiring manual review before production deployment

## Override Details

- 108 overrides switch mode to `per_side`
- Remaining 253 adjust visibility, minRepMs, maxRepMs, or dwellMs
- All overrides are conservative: numeric values clamped to safe bounds
  - visibility [0.2, 0.9], minRepMs [200, 10000], maxRepMs [1000, 30000], dwellMs [0, 500]
- Hold mode (`core_isometric`, `squat_hold`) is explicitly protected: overrides never change to `per_side` or `bilateral`
- Overrides never change the measured joint triplets, never create a pattern from whole cloth
- Overrides are not validation evidence

## Device-Validation Status

| Evidence | Status | Source |
|---|---|---|
| Engine unit tests | PASSED (synthetic landmarks) | `shared/__tests__/exerciseEngine.spec.ts`, 21 tests |
| Video pipeline tests | PASSED (synthetic frames) | `shared/__tests__/videoAnalysisPipeline.spec.ts`, 5 tests |
| Backend registry/launch tests | PASSED (mock catalog) | `backend/test/pose-tracker.spec.ts`, 24 tests |
| Frontend registry/bridge tests | PASSED | `frontend/tests/pose-tracker.test.mjs`, 9 tests |
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

Prerequisites for a real device run (from `POSETRACKER_ANDROID_SETUP.md`):
1. Android platform tools (`adb`) on PATH
2. `ANDROID_HOME` or `ANDROID_SDK_ROOT` set to SDK root
3. Device with USB debugging enabled, recognized by `adb devices`
4. Expo development build (not Expo Go) — `expo-mediapipe-pose` is a native module
5. Pose model asset at `mobile/assets/pose_landmarker_lite.task` (~5.7 MB)
6. Backend running and reachable at configured URL
7. Test account signed in within the app

## Accuracy-Validation Status

- **No genuine recordings** available in the repository
- Two PushUpBench clips exist (`ml/reports/t4_rep_counter/pushupbench_exercise_rep_results.json`) but: 0 exact matches, 0 within ±1 rep-count evidence
- `ml/models/pattern_v1` test macro-F1 0.36–0.47 is movement-classification evidence, not per-exercise rep-count evidence
- No exercise has met the evidence requirements for FULLY_SUPPORTED
- Accuracy benchmark framework (`POSETRACKER_ACCURACY_BENCHMARK.md`) is an empty schema — no records populated
- Dataset contribution system exists but has not been used to contribute ground-truth recordings
- **Conclusion: ACCURACY NOT VALIDATED — NO SUFFICIENT REAL-WORLD GROUND-TRUTH DATA**

## Summary

The PoseTracker implementation is **functionally complete** at the engine level:
- All 21 shared engine tests pass
- All 5 video pipeline tests pass
- All 24 backend pose tracker tests pass
- All 9 frontend pose tracker tests pass
- TypeScript checks pass for backend, frontend, and mobile
- 1500 exercises cataloged with generated tracking configurations
- 361 metadata-derived overrides applied conservatively
- No real-person per-exercise rep-count dataset exists to establish accuracy
- No physical-device validation has been performed

**Current readiness: IMPLEMENTATION VERIFIED — DEVICE VALIDATION PENDING.**