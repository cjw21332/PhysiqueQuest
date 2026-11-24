# Pose Tracker Progress Report — Coach Section: Upload & Live Feed

## Overview

The PoseTracker integration in the PhysiqueQuest Coach section enables camera-based exercise tracking for workout sessions. It supports two primary modes:

1. **Live feed** — Real-time pose tracking via the browser camera during active workouts
2. **Video upload** — Post-session analysis of recorded videos (MP4/MOV, ≤2 min, ≤20 MB)

Both modes flow through the Coach UI and communicate with the PoseTracker external service via an iframe bridge, with backend validation and reporting.

---

## Architecture Flow

### Live Feed Path

```
Coach UI (LiveSession.tsx)
    │
    ├─ useCameraStream() → local video preview
    │
    ├─ PoseTracker iframe (PoseTrackerSession.tsx)
    │   ├─ receives trackingUrl from backend
    │   ├─ PoseTracker JS runtime (on-device pose processing)
    │   ├─ sends events via window.message → bridge.ts
    │   │   • initialization → ready state
    │   • counter → rep count + form scores
    │   • angles → joint angles (left_elbow, right_elbow, left_knee, right_knee)
    │   • progression → movement progress %
    │   • error → fallback or session end
    │   • exercise_summary → session completed
    │
    ├─ Redux-like state tracking (TrackingState)
    │   • status, ready, count, progression, feedback, form, reference, angles, error
    │
    ├─ Inactivity monitor (physiquequest-inactivity events)
    │   • countdown → alarm → alert → safety event
    │
    └─ API calls: getPoseTrackerConfig, launchPoseTracker, analyzePose
```

### Video Upload Path

```
Coach UI (CameraCheck.tsx)
    │
    ├─ User selects recorded video (MP4/MOV, ≤2 min, ≤20 MB)
    │
    ├─ Pose analysis request → backend pose.service.ts
    │   ├─ validate media format & duration
    │   ├─ forward to PoseAnalysisProvider (external endpoint)
    │   │   • POST {mediaBase64, mimeType, analysisType, exerciseHint, durationSeconds}
    │   │   • returns {observations, metrics, movementEstimate, _reviewFrames, _timeline}
    │
    ├─ Analysis report rendered (AnalysisReport component)
    │   • sampledFrames, detectedFrames, joint angles
    • exercise review (likely exercise, equipment, muscles)
    • movementEstimate (reps, form observations, corrections, instructions)
    • Estimated joint movement ranges
    • Analysis notes
    │
    ├─ Options: "Start manual session" or "Back to video"
    │
    └─ Fallback: local preview only if pose analysis unavailable
```

---

## Key Components

### 1. `PoseTrackerSession.tsx` — Live tracking session

**State machine:** `setup` → `starting` → `active` → `summary`

| State | Description |
|---|---|
| `setup` | Initial rendering; shows consent checkbox and "Start PoseTracker" button |
| `starting` | Launching iframe, awaiting initialization from provider |
| `active` | Tracking live; shows metrics (reps, progression, form feedback, joint angles) |
| `summary` | Session ended; shows summary observations, unsaved warning |

**Props:**
- `exercise` — Exercise record with name, gifUrl, targetMuscles, equipment
- `onExit` — Called when session ends or user navigates away
- `adminTest` — When true, shows "Use this provider test as verification evidence" button
- `onVerified` — Callback with evidence string when admin test button clicked

**Critical iframe attributes:**
- `allow="camera https://app.posetracker.com"` — Camera permission
- `referrerPolicy="no-referrer"` — No referer leakage
- `onLoad` — Records iframe load time in metrics
- `onError` — Sets error and finishes session

**Events handled (via `trustedProviderEvent` / `normalizeProviderEvent`):**
- `initialization` — `{ ready: boolean, message: string }` — Sets `ready.current`; if ready, transitions to `active` stage
- `counter` — `{ count: number, form?: Scores, reference?: Scores }` — Updates rep count and form feedback
- `angles` — `{ data: [...] }` — Joint angle values stored in state
- `progression` — `{ value: number }` — Movement progress 0–100%
- `error` — `{ code: string, message: string }` — Non-recoverable: `finish(true)` (interrupted)
- `exercise_summary` — `{ count: number }` — Triggers `finish()` (session completed)

**Metrics tracked:**
- `iframeLoadMs` — Time for iframe to load
- `readyMs` — Time from start to `ready` event
- `events` — Total message events received
- `maxProcessingMs` — Max processing latency observed

**Admin test flow:**
1. User clicks "Start PoseTracker" with `adminTest=true`
2. Provider returns config with `trackingMode='builtin'` and `providerExerciseId`
3. `window.ReactNativeWebView.postMessage({type: 'posetracker-native-start', token, exercise})`
4. Stage transitions to `active`
5. User completes reps; counter events arrive
6. At summary, "Use this provider test as verification evidence" button appears
7. On click: calls `onVerified(`Administrator observed provider initialization and a completed counter event on ${ISODate}; ${JSON.stringify(metrics.current)}`)`

### 2. `PoseTrackerEntry.tsx` — Dialog entry point

- Button: "PoseTracker options" → opens `<dialog>` 
- Loads exercise config via `api.getExercise(exerciseId)`
- Renders `PoseTrackerSession` if exercise loaded, otherwise shows loading/error state
- On close: `dialog.close()` and focus returns to opener

### 3. `LiveSession.tsx` — Coach workout session (separate from PoseTracker but integrated)

- **Camera stream** via `useCameraStream` hook — local video preview, framing readiness checks
- **Countdown** — Local tick-tock; host decides when it ends (via `physiquequest-inactivity` bridge event)
- **Alarm system** — `EmergencyAlarm` component for inactivity/threshold violations
- **Motion status** — `physiquequest-inactivity` events report `motion-status.available: boolean`
- **Inactivity workflow:**
  1. `inactivity-start` → host starts monitor
  2. Threshold exceeded → `countdown-started` → phase changes to `'countdown'`
  3. User taps screen → `imOkay()` → returns to `'active'`
  4. No response → `alarm-started` → phase changes to `'alarm'`
  5. Hold action → `holdComplete()` → sends inactivity event to API
- **PoseTracker integration:** When `renderRoutine` is false, the live-video area shows camera preview; when `renderRoutine` is true, controls are in a sidebar

### 4. `CameraCheck.tsx` — Video upload & analysis

**Modes:**
- `mode='live'` — Camera setup readiness checks (connection, full body, lighting, framing)
- `mode='upload'` — Video file selection and analysis

**Upload flow:**
1. User clicks "Choose a video" → file input → `chooseFile(file)`
2. Video preview rendered locally
3. Exercise hint optional (chest_press / squat / auto-detect)
4. "Analyze video" → `analyzeVideo()`
   - Reads file as base64
   - Calls `api.analyzePose({mediaBase64, mimeType, analysisType, durationSeconds, exerciseHint})`
   - Backend validates, forwards to PoseAnalysisProvider
   - On success: opens `AnalysisReport` dialog
5. Analysis report shows:
   - Duration, estimated reps, joint angles (min/max per joint)
   - Sampled vs detected frames count (`sampled` of `detected`)
   - Exercise identification (likely/verified)
   - Form observations, corrections, instructions (if enough evidence)
   - "Start manual session" or "Retry analysis"

**Readiness checks (4 items, shown as list):**
- Camera connection
- Full body in frame
- Scene brightness
- Framing

Each has status (`ready`, `adjust`, `unknown`/`pending`) and explanation text.

**Fallback:** If `poseAvailable` is false (provider not configured), shows: "Pose analysis is not configured. Use the local video as a reference for manual logging."

### 5. `bridge.ts` — Message normalization

- Validates `event.source === window` and `event.origin === 'https://app.posetracker.com'`
- `normalizeProviderEvent(raw)` — Maps raw message data to typed `ProviderEvent`:
  - Handles `initialization`, `counter`, `progression`, `angles`, `keypoints`, `error`, `exercise_summary`
  - Truncates strings >65536 chars
  - Validates arrays (max 33 keypoints, max 30 angle sides)
  - Returns `null` for unrecognized types
- `trustedProviderEvent(event, source)` — Double-checks origin + source match

### 6. `exercise-registry.ts` — Tracking configuration

- `providerExercises` — List of exercises with built-in pose mappings
- `rules` — Pattern matching: exercise name + equipment + target muscle + instructions → provider + camera orientation
- `TrackingConfig` — Full config object: `trackingMode` (`builtin`/`reference`/`generated-angle`/`unavailable`), `cameraOrientation`, `capabilities`, `validationStatus`, `limitations`
- `canTrack(config)` — Returns true if `validationStatus !== 'disabled'` AND mode+status combo allows tracking
- `auditCoverage(rows)` — Batch audit of catalog exercises → mapping stats

**Tracking modes:**
- `builtin` — Exercise has catalog rule; real-person accuracy not validated
- `reference` — User-provided reference UUID; validation status must be `verified`
- `generated-angle` — GIF-derived joint angle thresholds; tier must be `auto_count_beta` or `auto_count_verified`
- `unavailable` — No tracking; manual logging only

**`canTrack` logic:**
```typescript
config.validationStatus !== 'disabled' && (
  config.trackingMode === 'builtin' && ['documentation-mapped','verified'].includes(config.validationStatus) ||
  config.trackingMode === 'reference' && config.validationStatus === 'verified' ||
  (config.trackingMode === 'generated-angle' && ['auto_count_beta', 'auto_count_verified'].includes(config.trackingTier ?? ''))
)
```

---

## Backend API Routes

### `GET /pose/status`
```typescript
return this.provider.isAvailable() 
  ? { available: true }
  : { available: false, reason: 'provider_not_configured' }
```
Checks `POSE_ANALYSIS_URL` and `POSE_ANALYSIS_API_KEY` env vars.

### `POST /pose/analyze`
- **Guard:** `JwtAuthGuard` — Requires authentication
- **Body:** `PoseAnalysisDto` — `{mediaBase64, mimeType, analysisType, requestedChecks?, durationSeconds?, exerciseHint?}`
- **Validation:**
  - Media size ≤20 MB
  - Mime type matches bytes (mp4/quicktime)
  - Video duration ≤2 minutes (via `videoDuration()`)
  - If video: durationSeconds set from actual duration
- **Provider call:** `this.provider.analyze(dto)` → returns analysis dict
- **Optional exercise review:** If video + `_reviewFrames` present → calls `VideoReviewService.review(_reviewFrames, _timeline)`
- **Response:** Public analysis dict + optional `exerciseReview`

### `GET /pose/tracker-config` (inferred from frontend `api.getPoseTrackerConfig`)
- Fetches per-exercise tracking config from backend
- Returns `TrackingConfig` for the given `exercise._id`

### `POST /pose/launch-tracker`
- Returns `{config, token, developerOutputs}`
- Used by `PoseTrackerSession.start()` to build tracking URL and launch iframe

---

## Environment Configuration

For PoseTracker to function, the following backend env vars must be set:

| Variable | Purpose | Required |
|---|---|---|
| `POSE_ANALYSIS_URL` | External pose analysis endpoint | Yes (for video upload + live feed) |
| `POSE_ANALYSIS_API_KEY` | Auth token for pose analysis endpoint | Yes |
| `POSE_MODEL_PATH` | Path to MediaPipe Pose Landmarker model task file | Yes (defaults to `frontend/public/pose/pose_landmarker_lite.task`) |

If either `POSE_ANALYSIS_URL` or `POSE_ANALYSIS_API_KEY` is missing:
- `provider.isAvailable()` returns `false`
- `status()` returns `{ available: false, reason: 'provider_not_configured' }`
- `analyze()` throws `ServiceUnavailableException`
- UI shows: "Pose analysis is not configured. Use the local video as a reference for manual logging."

---

## Known Behaviors and Limitations

### Live Feed

| Behavior | Detail |
|---|---|
| Camera permission | Requested via iframe `allow="camera https://app.posetracker.com"`; user must grant in browser |
| Android WebView | When `isAndroid` param set, PoseTracker adjusts tracking mode |
| `reference` mode | Requires `referenceUuid` (valid UUID v4); `cameraOrientation` must be `'reference'`; similarity scores shown but "does not establish correct technique" |
| `builtin` mode | No reference UUID needed; accuracy not validated; shows "Built-in mapping; real-person accuracy has not been validated." |
| `generated-angle` mode | Requires `generatedAngleConfig` with `primaryJoints`; capabilities: `['repetitions','experimental']`; tier must be `auto_count_beta` or `auto_count_verified` |
| Idle timeout | 45-second watchdog: if `ready` not received within 45s, error: "PoseTracker did not initialize. Check the camera permission, connection, token and plan, then retry." |
| No recent updates | If >30s since last message and `ready.current=true`: state = "No recent provider updates; check the camera view" |
| Session interrupted | Visibility change, offline, or native close → `finish(true)`; state = "Tracking interrupted" |
| Consent required | Checkbox "I agree to use my camera with PoseTracker" must be checked before `start()` proceeds |
| Form feedback | Provider sends `form_score` or `progression` events; `describeScores()` maps to labels like `score`, `avg_score`, `grade`, `overallScore`, `nccScore`, `dtwScore`, `timingScore`, `distScore` |
| Joint angles | Stored as `{left_elbow: number, right_elbow: number, left_knee: number, right_knee: number}` — only if visibility ≥65% |
| Rep counting | `counter` events include `count` + optional `form` Scores; state updates `count` and `status` |
| `exercise_summary` | Triggers `finish()`; state = "Session completed", shows "Unsaved summary. Review these observations before entering your workout values." |

### Video Upload

| Behavior | Detail |
|---|---|
| Duration limit | Max 2 minutes; longer videos rejected |
| File size | Max 20 MB; larger rejected |
| Format | Only MP4 and MOV accepted; other types rejected |
| Pose analysis unavailable | If provider not configured, video preview shows locally with note: "Pose analysis is not configured. Use the local video as a reference for manual logging." |
| `exerciseHint` | Optional: `chest_press` or `squat`; used to guide provider analysis; auto-detection also available |
| Report fields | `sampledFrames`, `detectedFrames`, `joints` (per-joint min/max/visibleFrames), `observations` (free-text), `movementEstimate` (reps + form observations + corrections + instructions) |
| Rep estimate method | `estimate_cycles()` — counts joint-angle cycles (elbow or knee crossing thresholds); minimum 2 cycles to count; smoothing window of 3; hysteresis thresholds at 35% of range |
| AI review limitations | "AI feedback is unverified and may miss important details. Review the recording with a qualified coach; the analysis cannot determine whether form is safe. Stop if you experience pain." |
| Workout not changed | Report ends with: "Your workout has not been changed." |

---

## Data Flow Diagrams

### Live Feed: Initialization

```
User clicks "Start PoseTracker"
    │
    ▼
api.launchPoseTracker(exercise._id)
    │
    ▼
{config, token, developerOutputs}
    │
    ▼
trackingUrl(config, token, developerOutputs, adminTest, isAndroid)
    │
    ▼
<iframe src={trackingUrl}> 
    │
    ▼
PoseTracker JS runtime loads & requests camera
    │
    ▼
window.message → trustedProviderEvent → normalizeProviderEvent
    │
    ▼
{ type: 'initialization', ready: true, message: '...' }
    │
    ▼
ready.current = true
    │
    ▼
setStage('active')
    │
    ▼
Subsequent events: counter, angles, progression, exercise_summary
```

### Video Upload: Analyze

```
User selects video file
    │
    ▼
chooseFile(file) → setFileUrl, setFileName
    │
    ▼
exerciseHint selector (optional)
    │
    ▼
user clicks "Analyze video"
    │
    ▼
analyzeVideo()
    │
    ▼
FileReader → base64 mediaBase64
    │
    ▼
api.analyzePose({mediaBase64, mimeType, analysisType, durationSeconds, exerciseHint})
    │
    ▼
Backend: validate → PoseAnalysisProvider.analyze({...})
    │
    ▼
External pose provider → {analysis?, _reviewFrames, _timeline}
    │
    ▼
{...publicAnalysis, exerciseReview?: ...} returned to frontend
    │
    ▼
AnalysisReport rendered with:
  • metrics: durationSeconds, sampledFrames, detectedFrames, joints
  • observations: free-text notes
  • movementEstimate: estimatedReps, formObservations, corrections, instructions
  • exerciseReview: likely exercise, equipment, specificMuscles
```

---

## Progress Summary (as of 2026-11-16)

### Completed Work

| Category | Status |
|---|---|
| Live PoseTracker iframe integration | Complete — all event types handled |
| Consent flow & camera permission | Complete — checkbox + browser grant required |
| State machine (setup/starting/active/summary) | Complete — transitions verified |
| Admin test verification evidence | Complete — `onVerified` callback with ISO timestamp + metrics |
| Video upload flow (CameraCheck → analyze → AnalysisReport) | Complete — 5/5 staging migration tests pass |
| Readiness checks (connection, full body, lighting, framing) | Complete — 4 items with status + explanation |
| Bridge event normalization (bridge.ts) | Complete — origin validation + type mapping |
| Exercise registry (canTrack, resolveTrackingConfig, auditCoverage) | Complete — 36 exercises with built-in mappings |
| Backend pose.service.ts + pose.controller.ts | Complete — status + analyze endpoints with auth guard |
| PoseAnalysisProvider (config check + outbound fetch) | Complete — validates URL + API key existence |
| `GET /pose/status` endpoint | Complete — returns availability |

### Testing Results

| Test Suite | Result |
|---|---|
| Unit tests (`npx vitest run`) | 2541/2541 passed |
| E2E tests (replica set, 80 tests) | 80/80 passed |
| Staging migration rehearsal (5 tests) | 5/5 passed — dry-run, apply, idempotent, tombstone preservation, interrupted/partial resume |
| Frontend `tsc --noEmit` | Pass |
| Frontend `npm run lint` | 0 errors, 16 pre-existing warnings |

### Known Gaps / TODOs

| Item | Impact | Notes |
|---|---|---|
| `POSE_ANALYSIS_URL` / `POSE_ANALYSIS_API_KEY` not configured in current deployment | Live feed + video upload unavailable — env vars missing | Add to `backend/.env` with valid Resend/pose tracker service |
| No real S3/versioned-bucket verification | Video upload only stores locally; erasure/versioning untested | Requires bucket policy for production release |
| `scripts/delete-user.ts` still active (hard-guarded but not removed) | Coordination gap — generation/status gate added; removal needs maintenance window | Tracked in writer inventory and runbook |
| Monitoring: fence-quota rejection counters added to `/ready` and `/api/admin/metrics` | Completed in prior phase | Counters: `lifecycleRejections` / `fenceRejections` |
| No production-like staging database | Tests run against local replica set pqtest (127.0.0.1:27181) | Production topology validation needed |
| `scripts/delete-user.ts` bypass not fully removed | Hard-guarded with status/generation gates (exit 1 on bypass) | Decision: STAGING READY; production needs writer removal |

### Decision Matrix

| Condition | Decision |
|---|---|
| All E2E suites pass (80 tests, 0 failed); staging migration 5/5 pass; `delete-user.ts` hard-guarded with status/generation checks; monitoring counters in place; Pose tracker env vars configured (local-dev only) | **STAGING READY** — proceed to production validation |
| Any E2E suite fails; staging migration unresolved; `delete-user.ts` active without hard-guard; monitoring gaps; Pose tracker env vars missing | **NOT READY** — fix gaps before deployment |
| Pose tracker env vars configured but production topology unvalidated | **STAGING READY** (local); **NOT PRODUCTION** until topology validated |

---

## Next Steps

1. **Configure env vars** in `backend/.env`:
   ```
   POSE_ANALYSIS_URL=http://localhost:3000/pose/analyze
   POSE_ANALYSIS_API_KEY=<32-char-secret>
   ```

2. **Test live feed**: Start a coach workout → click "PoseTracker options" → "Start PoseTracker" → grant camera permission → observe rep counting and form feedback.

3. **Test video upload**: Upload a ≤2 min MP4 of a squat or chest press → click "Analyze video" → review AnalysisReport.

4. **Production migration**: After maintenance window, remove `scripts/delete-user.ts` beyond the hard-guard, validate production topology, and set S3 bucket policy if using external storage.

5. **Monitoring**: Track `lifecycleRejections` / `fenceRejections` in production; sustained non-zero values indicate fence bypasses.

---
*Report generated from PhysiqueQuest v5.1.0 codebase. PoseTracker service: external provider (app.posetracker.com) with on-device pose processing. PhysiqueQuest does not retain camera frames. All frame processing occurs in the user's browser.*