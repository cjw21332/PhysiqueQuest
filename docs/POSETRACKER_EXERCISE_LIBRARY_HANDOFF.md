# PhysiqueQuest PoseTracker — Exercise Library Handoff for Claude

**Prepared:** 19 November 2026  
**Purpose:** Give Claude a source-grounded overview of PoseTracker as it currently exists in the PhysiqueQuest exercise library: how a user finds and starts tracking, what happens on-device and through the backend, the support status across the catalog, what has been observed on the phone, and what remains to prove before describing it as reliable.

## Executive summary

PhysiqueQuest has an exercise-library PoseTracker flow with two separate tracking routes:

1. **Installed Android app:** where the exercise configuration supplies a supported native movement pattern, camera frames are processed on the phone by the bundled MediaPipe Pose Landmarker Lite model. A shared exercise engine turns landmark movement into estimated complete reps, partial reps, phases, holds, and simple movement cues. The camera start gate requires the full body to stay visible for three seconds, followed by a 3–2–1 countdown before counting starts.
2. **Browser/provider route:** selected provider-mapped exercises can launch through the authenticated backend and a configured PoseTracker provider. Browser sessions depend on the provider connection and its returned tracking session. This is distinct from the native Android inference route.

The feature is **implemented, but not fully validated across the exercise catalog or devices**. The exercise library has 1,500 catalog entries. Current quality tiers classify 1,284 as manual, 211 as pose-only, and 5 as auto-count beta; there are **zero auto-count-verified exercises** under the repository's acceptance rule. Separately, many catalog entries map heuristically to shared native movement patterns, but those mappings are explicitly labeled partial or not yet validated. These figures describe the current source files and must not be presented as proof that 1,500 exercises are trackable or accurate.

The owner previously observed the native camera running on their phone and saw 12 complete and 1 partial rep live in one squat attempt. They then reported a later squat was not counted and the result showed zero reps/no time in an earlier build. The current code includes explicit complete/partial summary fields and elapsed tracking time, but the supplied conversation does not establish a successful repeat-rep, live-to-summary verification after the latest changes. Treat real-device reliability as **partially demonstrated, still requiring regression verification**.

## 1. What the user sees in the exercise library

Primary source: `frontend/sections/Coach/ExerciseLibrary.tsx`.

- The library supports search, body-part, equipment, target-muscle and secondary-muscle filters, sorting, pagination, exercise details, saved personal exercises, and exercise demonstrations.
- Catalog data and media have device caching paths. When the catalog cannot be reached, the UI can show saved exercises and labels that the demonstration may need a connection.
- Camera-enabled choices are given an early position in the default list via `trackingPriority`. This is a discovery convenience, **not** a confidence ranking or promise of accuracy.
- Each exercise resolves a PoseTracker configuration. The detail view distinguishes camera tracking from manual tracking. Camera entries that are not verified are labeled **“Camera tracking · needs review.”** Personal exercises use manual tracking.
- A camera-tracking exercise can open PoseTracker setup. If the configuration is unavailable, the existing flow can leave the user with manual workout logging.
- Some catalog support records are produced from exercise metadata and shared movement-family mapping. A name such as “machine press” can therefore inherit a general horizontal or vertical push counter even when the exact machine exercise has not been individually validated. That is why the app describes these as estimates and why the library label must not be read as a quality certification.

The exercise library, catalog, and tracking configuration are related but not identical: an exercise may be searchable in the library while being manual-only; it may have pose-only support without rep counting; or it may map to a heuristic counter that is still unvalidated for that specific exercise.

## 2. Architecture and data flow

```text
Exercise Library (frontend)
  ├─ Fetch/cache 1,500 exercise catalog records and filters
  ├─ Resolve tracking config per exercise
  └─ Show camera / needs-review / manual status
       │
       ├─ Android app + native pattern configured
       │    └─ authenticated launch → WebView bridge → native tracking screen
       │         └─ Camera → bundled MediaPipe Lite model → landmarks
       │              → full-body gate → 3–2–1 → shared exercise engine
       │                   → live counts/cues → validated summary payload
       │
       └─ Browser/provider-mapped exercise
            └─ authenticated backend launch → provider token/config
                 → trusted provider session/frame events → summary UI
```

The native Android movement analysis itself is on-device. The backend is still involved in authentication and retrieving the authoritative exercise tracking configuration before launch. A native pattern does not need the external PoseTracker provider token; provider-backed modes do. On-device exercise tracking can operate without an internet connection after the app, native module, and model asset are installed, while login, fresh catalog/configuration retrieval, and provider-backed tracking still depend on service/network availability. Cached library data covers some offline browsing; it does not mean every application function is offline-capable.

## 3. Configuration and backend responsibilities

Primary sources: `backend/src/pose-tracker/exercise-registry.ts`, `backend/src/pose-tracker/pose-tracker.module.ts`.

- One pure shared registry resolves an exercise from catalog metadata, generated catalog-tier data, generated native-pattern mapping, and any administrator override. The same registry is imported by browser, backend, and catalog audit code.
- Exercise metadata used for matching includes exact normalized name, equipment, target muscles, and relevant instruction text. Provider mappings are deliberately a small exact-match whitelist (10 current rules), rather than a substring-only guess.
- The generated native map can associate an exercise ID with one of 20 implemented engine pattern families, such as squat, lunge, hinge, horizontal/vertical push or pull, curl, raise, calf raise, hip thrust, core, dip, jumping jack, high knees, and mountain climber. Per-exercise overrides can adjust selected thresholds, view/mode, or hold settings within bounded limits.
- A persisted administrator override takes precedence over generated mapping. Admin routes support coverage auditing and configuration updates; the regular routes require authentication, and launch has a rate-limit guard.
- Relevant routes are `GET /pose-tracker/exercises/:id`, `POST /pose-tracker/exercises/:id/launch`, `POST /pose-tracker/configurations` (at most 100 IDs), and admin coverage/configuration routes under `/admin/pose-tracker`.
- Provider launch requires `POSETRACKER_ENABLED=true` and `POSETRACKER_API_TOKEN`. The native-pattern and generated-angle paths return without a provider token. A native pattern can be launched by an installed client even where the base tracking mode is otherwise unavailable, provided `canTrack` accepts that native pattern.
- Configuration validation forbids `verified` and `auto_count_verified` today: the code states no family has passed the pooled `n >= 25` and at least 70% within ±1 repetition gate. A future verified label needs recorded evidence and an explicit policy change, not an optimistic UI label.

## 4. On-device Android tracking — detailed session flow

Primary sources: `frontend/sections/Coach/PoseTrackerSession.tsx`, `mobile/PoseTrackerNative.tsx`, `mobile/NativeTrackingCamera.tsx`, `mobile/poseStartGate.ts`, `shared/exerciseEngine.ts`, `shared/poseSessionSummary.ts`.

### Setup and launch

1. The frontend fetches/uses the resolved exercise configuration and presents an estimate/review notice. For the native camera session, the user gives camera permission and sees session-specific camera-analysis consent in setup.
2. The frontend requests an authenticated launch configuration. When the installed Android WebView and the exercise config expose a native pattern, the frontend sends a `posetracker-native-start` message over the React Native WebView bridge. Otherwise, the frontend may take the browser/provider path when that configuration is supported.
3. The native view requests Android camera permission and displays the exercise title, support caveat, camera preview area, live counter, status/help text, and session actions during camera/model startup. The intended actions are switch camera, pause/resume, and end session; no upload-video action is part of this native session UI.

### Camera and model

- The app uses `expo-mediapipe-pose` through the optional native module, not Expo Go. It loads the bundled `mobile/assets/pose_landmarker_lite.task` model, requests one pose, disables segmentation and built-in skeleton drawing, and renders its own pose overlay.
- Camera starts front-facing; the user can switch between front and back. A switch suspends the counter and requires position/readiness again. Pause also suspends counting and pauses the active-time clock; resume restarts camera readiness.
- Camera lifecycle, native view identity, facing, frame geometry, monotonic frame IDs, and inference payloads are checked. Obsolete callbacks are ignored; camera/model/interruption errors fall back to a human-readable status/manual path.
- Normal tracking callbacks are limited to about 10 frames per second. If inference exceeds 80ms or the device reports serious thermal state, the code reduces callbacks to about 5 per second. Critical thermal state interrupts tracking. This is an adaptive safeguard, not a guarantee of smooth performance on every low-end phone.
- The installed model is packaged with the Android app. Once installed and loaded, native pose estimation itself does not need to send frames to the backend. The app's consent text says native frames are processed on-device, not uploaded or retained by PhysiqueQuest.

### Readiness gate, countdown, and counting

- The gate checks pose landmarks for the nose, shoulders, hips, knees, and ankles, requiring confidence/visibility at least 0.4 and coordinates within the central 1%–99% of the frame.
- The start gate accumulates 3,000ms of visible-body time, tolerates short detection flicker of up to 750ms, and then exposes a visible three-to-one countdown. Rep/partial counting only starts after this gate becomes active.
- If the body leaves frame or stays undetected, the gate resets/restarts and counting is suspended. A brief continuity gap may be tolerated by the gate but should not be mistaken for robust occlusion handling.
- The exact body visibility threshold and single-camera framing may be too strict for some exercises, camera angles, clothing, lighting, body shapes, and small screens. The model only estimates landmarks; it cannot establish safe or clinically correct exercise form.

### Movement engine and live screen

- `shared/exerciseEngine.ts` is the common geometry/counter engine used by live tracking and the recording-analysis paths. It defines 20 movement families with joints, camera/view assumptions, start/peak thresholds, ROM and duration limits, smoothing/dwell behavior, phases, repetition and hold logic, and cue/fault rules.
- Live output has movement phase/progress, angle/ROM estimates, complete reps, partial reps, holds/hold duration when applicable, visibility, cues, and rule-based observations. A complete rep must reach the engine's target thresholds; an unfinished range can be tallied as partial when the pattern logic qualifies it.
- The on-camera overlay shows separate **COMPLETE REPS** and **PARTIAL REPS** counters for rep movements (hold patterns show longest hold and qualifying holds), a 3–2–1 readiness countdown, tracking status, and a simplified skeleton overlay. Counts are movement estimates, not technique grades.
- Selected heuristics include visible cues such as knee-valgus, body-line, neutral-spine, torso-swing, and knee-over-toe; these are geometry rules. They do not determine pain, injury, equipment load, or safety.
- UI state updates are throttled to about 5 times per second, with count events allowed through sooner, while the inference callback can run faster. This reduces React rendering overhead but does not lower the native model's work to a fixed device-independent amount.

### End, pause, and summary

- The native session tracks elapsed active time with a monotonic session clock; paused time is excluded. Leaving/backgrounding the app ends the session through its lifecycle handling.
- The native end payload uses explicit numeric fields: `completeReps`, `partialReps`, `durationSeconds`, and, for holds, `holdMs`. `parseNativePoseSummary` validates these values before the frontend uses them. The frontend summary labels complete and partial reps separately and displays tracking time.
- The summary is not automatically saved to the user's workout. User must review it before manually logging sets. This keeps an uncertain estimate from silently changing workout history.
- If no tracking result was received, the UI should say no count was received, rather than treating it as a valid zero. This distinction is important given the previously reported live-count/zero-summary defect.

## 5. Browser and external provider route

- Provider-backed modes need an authenticated backend launch, provider enabled/token configured, and a connection to the provider. The backend only returns provider credentials after validating the exercise config and applying rate limits.
- Frontend provider messages are accepted only from the configured/trusted origin and expected window source; incoming progression/angle events are throttled before UI updates. Raw keypoint streams are not used for application state/rendering.
- Provider-reported reps, form feedback, or reference similarity are estimates and remain separate from verified technique or safety assessments.
- The local video-analysis service/recording review feature is a different workflow from the live on-device Android PoseTracker. Do not describe uploaded-video analysis as the engine that powers the offline native exercise-library camera counter.

## 6. Catalog coverage and validation status

Source: `backend/src/pose-tracker/catalog-tiers.ts` contains 1,500 exercise IDs. Current exact tier counts:

| Catalog tier | Count | What this means |
|---|---:|---|
| Manual | 1,284 | No catalog tier for automatic rep counting; use manual workout logging. |
| Pose-only | 211 | Pose/visibility-related classification, not a promise of a usable repetition counter. |
| Auto-count beta | 5 | Experimental/research tier; not verified production accuracy. |
| Auto-count verified | 0 | Deliberately blocked until the stated validation gate is met. |
| **Total** | **1,500** | Current catalog tiers, not count of working PoseTracker exercises. |

Separately, `catalog-tracking.generated.ts` maps exercise IDs heuristically to shared native patterns and support labels. The registry always explains these as shared pattern-level thresholds and says the exact exercise has not been validated on real recordings; it classifies them as partially supported or not yet validated. Do not add a native-pattern map count to the tier counts or imply they are equivalent categories: they are two different axes (catalog evaluation tier versus whether a native pattern can launch).

### Evidence needed before an exercise can be called verified

The current source validation gate requires at least 25 pooled observations and at least 70% of estimated rep counts within ±1 of reference for a movement family. That is a minimum gate stated in code, not a complete scientific validation plan. A credible exercise-level release should also define:

- Exercise identity and equipment, camera orientation, distance, visibility/framing, lighting, and whether one or both sides are visible.
- Ground-truth rep annotations and partial-rep definitions, with multiple users, body types, clothing, execution tempos, phone models, and recording conditions.
- Error metrics (count error, false positives, missed reps, partial-vs-complete confusion), confidence intervals, and failure cases.
- Repeated tests after pause/resume, camera switch, temporary body loss, app backgrounding, thermal throttling, and session finish/summary parsing.
- A clear distinction between “pattern can run,” “beta estimate,” “validated rep counter,” and “form/safety assessment” (the last is not provided).

## 7. Progress and what has been observed

### Implemented in the current source

- Exercise-library configuration resolution and status labels, prioritization of camera-enabled results in the default view, server-backed search/filter/configuration, and locally cached catalog browsing.
- Authenticated launch split between native pattern mode and provider-backed mode.
- Bundled native pose model and Android camera view; front/back switching; pause/resume/end controls; readiness overlay, skeleton, separate complete/partial counts, cues, and elapsed time.
- Three-second whole-body readiness accumulation and 3–2–1 countdown before count acceptance.
- Shared counter engine, summary schema validation, paused-time exclusion, thermal/inference throttling, lifecycle handling, and user-facing fallbacks.
- Honest caveats in setup/library/report copy; session results do not write directly into a workout.
- Automated test files exist for shared exercise counting, summary parsing, start gate, frame timing, native navigation, browser pose flow, library and tracking performance. Their existence does **not** establish that they currently pass or that hardware behavior is correct.

### Device evidence and unresolved risk

- In prior direct phone use, the user confirmed that the camera preview worked and reported live squat values of 12 complete reps and 1 partial rep in one session.
- The user also reported a subsequent repetition did not register. An earlier attempt showed zero reps and no tracking time in the result after live activity. Later source changes made the summary fields explicit and validate them, but this handoff has no fresh user-confirmed result proving the discrepancy is gone.
- The user has asked for smooth performance on low-end devices. Adaptive frame throttling exists, but no benchmark matrix or evidence of consistent low-end performance is recorded here.
- No evidence in this handoff proves all mapped exercises work, every supported Android model works, provider tokens/configuration are present in production, or the installed tester APK matches the latest workspace source.

## 8. Important boundary between local code, installed APK, and deployed services

This document describes the repository source inspected for the handoff. The workspace has had extensive local changes during the project, and the user previously reported an unsuccessful backend deployment build. Do not assume the current checked-out source, deployed backend, latest generated APK, user's installed APK, and testers' APK are identical. Before attributing behavior to a release, record:

- Git commit and clean/dirty state used for the Android build.
- Android app version/version code and APK SHA-256 for both owner's and tester build.
- Backend deployed commit/build and health/readiness status.
- Whether the app uses the intended deployed API URL (not `localhost` or a machine-specific LAN address).
- Presence/status of provider settings if testing the browser/provider path (never expose secret values in the report).
- Device model, Android version, camera facing, exercise ID, lighting/framing, and exact live/summary values.

If the installed APK has a different camera path or features such as live feed, compare its build identity before diagnosing backend/configuration problems. The native camera functionality is packaged with the mobile app; it is not supplied by a server at the developer's Wi-Fi address.

## 9. Recommended next work for Claude

Prioritize these in order:

1. **Reproduce the squat live-to-summary issue on the current installed build.** Record live complete/partial counts, elapsed timer, and summary values for at least three controlled sessions, including two consecutive repetitions and one partial repetition. Confirm `finishSession` is invoked once and app background handling cannot race the explicit end action.
2. **Audit camera lifecycle and repeat-count state.** Test the front camera, switch to rear and back, pause/resume, brief full-body loss, permissions, app background/foreground, and end while paused. Ensure counts persist across suspension while movement phase resets, and active time pauses correctly.
3. **Make exercise support transparent and safe in the library.** Keep default camera prioritization, but ensure unsupported/manual, pose-only, beta, partially supported, and verified are visibly distinct. Avoid “fully working” claims for heuristic catalog mappings. Make the per-exercise detail tell the user the recommended camera view/framing and known limitations.
4. **Build a repeatable evaluation set.** Annotate reference reps/partials for representative pattern families and validate across users/devices. Do not promote to verified until the acceptance criteria and per-exercise limits are recorded.
5. **Benchmark lower-end phones.** Measure inference FPS/duration, UI responsiveness, skipped frames, thermal effects, battery use, camera recovery, and count accuracy. Tune model/callback/render frequencies from measurements, not assumed hardware performance.
6. **Check release parity.** Build from a known commit, compute artifact hash, install that exact APK, and verify its API base URL and native model asset. Separately confirm backend deployment for provider-backed/browser sessions.
7. **Run existing automated checks and physical-device regression.** Record commands, pass/fail, device matrix, actual counts, and issues. A code-level unit test cannot replace camera hardware testing.

## 10. Safe description to use with testers

> PoseTracker uses your phone camera to estimate body landmarks and movement. For supported exercises, the Android app processes the camera view on-device and estimates complete or partial repetitions after your whole body is visible and the countdown finishes. Results can be wrong, especially for exercises or camera views that have not been individually validated. It does not judge whether a movement is safe, diagnose injury, or automatically save the session to your workout. Review the estimate and use manual logging if tracking is unavailable or seems incorrect.

For provider-backed browser tracking, add that a network connection and configured external provider are required, and explain the applicable provider data processing before asking the user to proceed.

## Source files reviewed

- `frontend/sections/Coach/ExerciseLibrary.tsx`
- `frontend/sections/Coach/PoseTrackerSession.tsx`
- `backend/src/pose-tracker/exercise-registry.ts`
- `backend/src/pose-tracker/pose-tracker.module.ts`
- `backend/src/pose-tracker/catalog-tiers.ts`
- `backend/src/pose-tracker/catalog-tracking.generated.ts`
- `mobile/PoseTrackerNative.tsx`
- `mobile/NativeTrackingCamera.tsx`
- `mobile/poseStartGate.ts`
- `shared/exerciseEngine.ts`
- `shared/poseSessionSummary.ts`
- Relevant tests under `frontend/tests`, `mobile`, and `shared/__tests__` (listed, not executed for this handoff).
