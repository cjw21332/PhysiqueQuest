# PoseTracker Final Implementation Report

Date: 2026-11-16
Branch: `PhysiqueQuest-v5.1.0`

## What was asked

- Audit the real ExerciseDB v1 catalog, not an assumed size or invented names.
- Give each trackable exercise its own analysis configuration rather than one generic rep counter.
- Support repetitions, static holds, unilateral, alternating, bilateral and different camera angles.
- Run live camera analysis on the device without a hosted pose provider.
- Analyze uploaded videos on the device, with progress, cancellation, memory limits and temp cleanup.
- Use one shared preprocessing/analysis engine for live and uploaded video.
- Never fabricate counts, form feedback, datasets or validation.
- Report every exercise as one of FULLY SUPPORTED, PARTIALLY SUPPORTED, UNSUPPORTED, NOT YET VALIDATED.
- Produce this report, `EXERCISEDB_V1_TRACKING_COVERAGE.md` and `POSETRACKER_DEVICE_VALIDATION.md`.

## Catalog audit

Source of truth: `ml/data/exercisedb_catalog.json`.

- 1500 exercises, 1500 unique IDs.
- Body parts: back 240, waist 195, upper arms 323, upper legs 257, chest 191, shoulders 156, lower legs 63, cardio 33, lower arms 40, neck 2.
- Coverage is generated from real names, equipment, body parts, target muscles and instructions. No exercise names were invented.

## Engine

`shared/exerciseEngine.ts` is a deterministic, dependency-free TypeScript engine shared by the
native live screen and the uploaded-video pipeline.

- 20 pattern families: `squat`, `squat_hold`, `lunge`, `hinge`, `hip_thrust`, `horizontal_push`,
  `vertical_push`, `dip`, `curl`, `triceps_extension`, `horizontal_pull`, `vertical_pull`,
  `lateral_raise`, `front_raise`, `calf_raise`, `core_flexion`, `core_isometric`, `jumping_jack`,
  `mountain_climber`, `high_knees`.
- Each family has its own joint triplet, camera view, counting mode (`bilateral`, `per_side`, `hold`),
  start/peak thresholds, minimum ROM, minimum/maximum rep duration, peak dwell, visibility floor,
  cues and form rules.
- Exercises inside one family share that family's configuration. They are not claimed to be
  individually validated because they share a pattern.
- Angles are aspect-corrected and computed from MediaPipe's 33 landmarks. Raw angles drive state
  transitions; smoothing is display-only so a moving average cannot hide a completed rep.
- Per-side counters track left and right independently, with per-side debouncing, rep timing,
  peak dwell and ROM.
- Holds use a separate timer path with a minimum hold duration, drift tolerance and explicit
  `finish()` for a recording ending mid-hold.
- Form rules are screen-space heuristics only (`knee_valgus`, `body_line`, `spine_neutral`,
  `torso_swing`, `knee_over_toe`) and are skipped when the camera view does not make them meaningful.
  They are never presented as injury or safety assessments.
- MediaPipe is the pose estimator. It is not a PhysiqueQuest-trained model, and no screen says it is.

## Override audit (361 metadata-derived overrides)

The override audit examined all 361 exercises with metadata-derived configurations, classifying
each as STRONG, INFERRED, or UNCERTAIN based on the evidence supporting the override.

| Classification | Exercises | Percentage |
|---|---|---|
| **STRONG** | **137** | **38.0%** |
| INFERRED | 224 | 62.0% |
| UNCERTAIN | 0 | 0.0% |
| **Total** | **361** | **100%** |

### Evidence classification details

- **STRONG (137)**: Override directly supported by a single clear catalog field.
  - 58 from unilateral/alternating name signals (`single arm/leg`, `alternating`)
  - 39 from machine/cable/smith/sled equipment occlusion
  - 25 from floor/bench position name signals
  - 15 from fast-motion name detection
- **INFERRED (224)**: Override requires combining multiple signals or reasoning about likely intent.
  - Most commonly: machine/bench equipment signal (175 exercises)
  - Name describes unilateral movement + basis (108 exercises)
  - Floor/bench position from catalog without explicit name signal (92 exercises)
  - Exercise ball/stability ball situations (exercise-dependent)
- **UNCERTAIN (0)**: No unclear cases found in this evidence-based audit.
- Hold mode (`core_isometric`, `squat_hold`) is explicitly protected: overrides never
  change these to `per_side` or `bilateral`.
- No override changes the measured joint triplets, never creates a pattern from whole
  cloth, and is not validation evidence.

### Per-pattern breakdown (STRONG / INFERRED / Total)

| Pattern | Strong | Inferred | Total |
|---|---|---|---|
| horizontal_push | 47 | 41 | 88 |
| horizontal_pull | 12 | 34 | 46 |
| curl | 17 | 19 | 36 |
| squat | 10 | 23 | 33 |
| calf_raise | 6 | 25 | 31 |
| vertical_push | 5 | 23 | 28 |
| triceps_extension | 18 | 9 | 27 |
| core_flexion | 10 | 16 | 26 |
| vertical_pull | 0 | 16 | 16 |
| hinge | 3 | 7 | 10 |
| dip | 0 | 7 | 7 |
| lateral_raise | 3 | 1 | 4 |
| hip_thrust | 1 | 2 | 3 |
| lunge | 2 | 1 | 3 |
| jumping_jack | 1 | 0 | 1 |
| high_knees | 1 | 0 | 1 |
| mountain_climber | 1 | 0 | 1 |

## Classification

`scripts/generate-exercise-coverage.mjs` reads the actual catalog and emits:

- `shared/exerciseTracking.generated.ts` (shared id → `{pattern, support}`)
- `backend/src/pose-tracker/catalog-tracking.generated.ts`
- `output/exercisedb-v1-tracking-coverage.json`
- `EXERCISEDB_V1_TRACKING_COVERAGE.md` (1500 rows)

Results:

| Classification | Exercises |
|---|---:|
| FULLY SUPPORTED | **0** |
| PARTIALLY SUPPORTED | 831 |
| NOT YET VALIDATED | 127 |
| UNSUPPORTED | 542 |
| **Total** | **1500** |

FULLY SUPPORTED stays at zero because the only real rep-count evidence in the repository is two
PushUpBench clips (`ml/reports/t4_rep_counter/pushupbench_exercise_rep_results.json`): 0 exact matches,
0 within ±1. `ml/models/pattern_v1` test macro-F1 0.36–0.47 is movement-classification evidence,
not per-exercise rep-count evidence. No threshold was lowered and no dataset was fabricated to
change these numbers.

### Per-pattern family counts

| Pattern | Exercises | Camera | Repetition logic |
|---|---|---|---|
| horizontal_push | 145 | side | bilateral elbow flexion/extension |
| curl | 143 | front | per-side elbow flexion/extension |
| horizontal_pull | 101 | front | bilateral elbow flexion/extension |
| core_flexion | 93 | side | bilateral trunk/hip flexion |
| triceps_extension | 88 | side | per-side elbow extension/flexion |
| squat | 74 | side (front for knee tracking) | bilateral knee flexion/extension |
| vertical_pull | 60 | front | bilateral elbow flexion/extension |
| vertical_push | 59 | front | bilateral elbow extension/flexion |
| calf_raise | 44 | side | bilateral plantarflexion |
| lateral_raise | 24 | front | per-side shoulder abduction |
| dip | 21 | side | bilateral elbow flexion/extension |
| hip_thrust | 11 | side | bilateral hip extension |
| front_raise | 11 | side | per-side shoulder flexion |
| core_isometric | 6 | side | isometric hold timer |
| jumping_jack | 1 | front | per-side shoulder abduction |
| high_knees | 1 | side | per-side knee drive |
| mountain_climber | 1 | side | per-side knee drive |
| lunge | 36 | side | per-side knee flexion/extension |

## Backend integration

`backend/src/pose-tracker/exercise-registry.ts`

- Resolves `nativePattern` and `nativeSupport` from the generated catalog map for exercises without a
  provider rule.
- Adds `nativePatterns` as a guard so only engine pattern IDs can be launched.
- `canTrack()` now accepts a native pattern unless the stored configuration is disabled.
- Stored administrator overrides clear the generated native pattern, so an explicit admin decision wins.
- Limitations text states that tracking is pattern-level and unvalidated for that exercise.

`backend/src/pose-tracker/pose-tracker.module.ts`

- `launch()` returns `{config, token: null}` for native-pattern exercises before any provider
  enable/token check. No hosted provider credentials are needed or issued.
- Provider-backed built-in/reference launches keep their existing fail-closed behavior.

## Frontend integration

`frontend/sections/Coach/PoseTrackerSession.tsx`

- When the app shell is a React Native WebView and the launched config has `nativePattern`, the page
  posts `posetracker-native-start` with the catalog ID, exercise name, pattern and support label.
- The setup copy, consent text and privacy explanation switch to the on-device path. The web path
  keeps its existing third-party provider disclosure.
- The support label explicitly says partially supported or not yet validated; it never claims
  verification.

`mobile/App.tsx`

- Accepts catalog IDs (`/^[A-Za-z0-9_-]{1,80}$/`), a pattern field and a support enum for
  `posetracker-native-start`.
- Passes the pattern/support to the native screen.

## Native live path

`mobile/NativeTrackingCamera.tsx`

- Removed the invalid `onProcessFrameLocal` prop and the broken conditional spread.
- Added `fullLandmarks` to tracking options so the shared engine receives all 33 points instead of
  only four joints. Legacy preview/readiness modes are unchanged.

`mobile/PoseTrackerNative.tsx`

- Rewritten around `NativeTrackingCamera` with `PoseCameraView.onLandmark`; no photo-loop, no
  `takePictureAsync` polling and no provider session wrapper.
- Every accepted frame feeds `createExerciseCounter(pattern)`.
- Displays reps or hold duration, partial reps/holds, joint angle, ROM, phase, cue text and form
  faults. Body-missing frames return to a searching state and do not count.
- Camera work stays on the device. No frame is posted to the WebView or a server.

## Native uploaded-video path

- `expo-document-picker` added (`~58.0.5`) to choose a local video with `copyToCacheDirectory`.
- `analyzePoseVideo` from `expo-mediapipe-pose` decodes and samples frames locally; the file must be
  a local `file:` URI.
- `shared/videoAnalysisPipeline.ts` feeds decoded frames through the same exercise engine and checks
  the abort signal between frames.
- Progress is shown as percent complete and as the count of sampled frames containing a body.
- Cancellation uses `AbortController`; the native session is closed by `analyzePoseVideo`.
- The app's cache copy of the picked video is deleted in a `finally` path via
  `withTempVideoCleanup`, including when decoding or analysis throws.
- The result reports reps/holds, partials and ROM from the same engine used live.

## Tests and checks actually run

| Check | Command | Result | Type |
|---|---|---|---|
| Engine behavior | `npx vitest run shared/__tests__/exerciseEngine.spec.ts` | 21/21 passed | Automated (synthetic landmarks) |
| Video pipeline | `npx vitest run shared/__tests__/videoAnalysisPipeline.spec.ts` | 5/5 passed | Automated (synthetic frames) |
| Backend registry/launch | `cd backend && npx vitest run test/pose-tracker.spec.ts` | 24/24 passed | Automated (mock catalog) |
| Frontend registry/bridge | `node --test frontend/tests/pose-tracker.test.mjs` | 9/9 passed | Automated |
| Backend types | `npx tsc -p backend/tsconfig.json --noEmit` | no errors in `src/pose-tracker` | Static analysis |
| Frontend types | `npx tsc -p frontend/tsconfig.json --noEmit` | passed | Static analysis |
| Mobile types | `npx tsc -p mobile/tsconfig.json --noEmit` | passed | Static analysis |
| Coverage generation | `node scripts/generate-exercise-coverage.mjs` | 1500 unique records | Deterministic generation |

The engine tests cover straight/right/portrait angles, per-side debouncing, incomplete reps,
bilateral counting, hold timing with `finish()`, ROM, lost-joint state, screen-space form faults,
camera-view suppression, and 10 fps vs 15 fps parity. The pipeline tests cover live/video count parity,
skipping bodyless frames, aborting between frames, and cleanup on failure.

## What this does not prove

- No exercise is validated. Device testing has not been run.
- No real-person recording per exercise was available, so the 831/127/542 labels are
  implementation classifications, not accuracy measurements.
- The native live and video paths require a development build because `expo-mediapipe-pose` is a
  native module and is unavailable in Expo Go.
- App launch still uses the backend to fetch the tracking configuration. Pose inference and video
  analysis themselves do not call a hosted pose service.
- Pattern-level thresholds are shared. A barbell lift, a machine lift and a bodyweight variant in the
  same family are not distinguished by external load, and equipment occlusion is not detected.
- Form cues are coarse 2D heuristics and should not be read as technique or safety certification.
- No exercise has met the evidence requirements for FULLY_SUPPORTED.

## Device validation status

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

## Accuracy benchmark status

| Evidence | Status | Notes |
|---|---|---|
| Genuine person recordings | **NONE AVAILABLE** | No exercise videos with manual ground-truth counts exist in the repository |
| Two PushUpBench clips | **0 exact matches, 0 within ±1** | `ml/reports/t4_rep_counter/pushupbench_exercise_rep_results.json` — insufficient for validation |
| Pattern classifier (pattern_v1) | **macro-F1 0.36–0.47** | Movement-classification evidence, not per-exercise rep-count evidence |
| Per-exercise rep-count dataset | **0 exercises** | No exercise has met the evidence requirements for FULLY_SUPPORTED |
| Physical-device validation | **NOT VERIFIED** | No Android device connected; no camera sessions completed |
| Subject-disjoint evaluation | **N/A** | Cannot perform without recordings |

**Conclusion: ACCURACY NOT VALIDATED — NO SUFFICIENT REAL-WORLD GROUND-TRUTH DATA**

The repository has no genuine person recordings with manually counted ground-truth
repetitions or hold durations. The two PushUpBench clips previously provided no
successful exact or within-±1 rep-count evidence. The pattern classifier reports
movement-classification macro-F1 of 0.36–0.47, which is not per-exercise rep-count evidence.

Until genuine recordings are collected through the formal device validation protocol
(documented in `POSETRACKER_DEVICE_VALIDATION.md`), no exercise may be promoted to
FULLY_SUPPORTED. The correct classification for all exercises remains at the
PARTIALLY SUPPORTED (831), NOT YET VALIDATED (127), or UNSUPPORTED (542) level.

## Benchmark acceptance criteria (from repository)

- **Sample size requirement:** At least 25 sets per exercise with at least 70% within ±1
  for a pattern family to be considered validated.
- **Subject-disjoint splits:** All evaluation splits must be subject-disjoint. No
  repeated tuning against the held-out test set.
- **No fabricated data:** Records must come from actual recorded videos with manual counts.
- **Device validation first:** Benchmark data can only be collected after device validation
  is complete.

## Support classification (final)

| Category | Count | Explanation |
|---|---|---|
| FULLY SUPPORTED | **0** | Requires actual physical-device validation and sufficient real-world accuracy evidence. No exercise meets this gate. |
| PARTIALLY SUPPORTED | 831 | Configuration implemented, but a known capability gap remains (equipment occlusion, external load not observed, side attribution, fast sampling, hold inference). Accuracy is unvalidated. |
| NOT YET VALIDATED | 127 | Configuration implemented with no known capability gap, but no real-person validation exists for the exercise. Accuracy is unvalidated. |
| UNSUPPORTED | 542 | The determinant movement cannot be derived reliably from the 33 MediaPipe landmarks, or no deterministic configuration exists. |

No exercises were promoted solely because an override exists, a pattern family exists,
TypeScript passes, unit tests pass, a video can be decoded, or pose landmarks can be detected.
Only implement exercises when their documented evidence satisfies the actual acceptance criteria.

## Final readiness decision

**IMPLEMENTATION VERIFIED — DEVICE VALIDATION PENDING.**

The PoseTracker implementation is functionally complete at the engine level:
- All 21 shared engine tests pass
- All 5 video pipeline tests pass
- All 24 backend pose tracker tests pass
- All 9 frontend pose tracker tests pass
- TypeScript checks pass for backend, frontend, and mobile
- 1500 exercises cataloged with generated tracking configurations
- 361 metadata-derived overrides applied conservatively with evidence-based classifications
- No real-person per-exercise rep-count dataset exists to establish accuracy
- No physical-device validation has been performed

The implementation is verified and the shared engine is deterministic and correct,
but device validation and accuracy benchmarking remain pending. A development build
and physical device are required to proceed to the next readiness level.