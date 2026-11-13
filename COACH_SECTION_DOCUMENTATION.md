# Coach Section - Complete Feature Documentation

## Overview

The Coach Section is the core workout experience of PhysiqueQuest, providing an AI-driven personalized training system with live camera-based form tracking, video upload analysis, inactivity detection safety features, and comprehensive workout reporting. The section orchestrates multiple interconnected views: **Plan**, **Library**, **Camera Check**, **Live Session**, and **Workout Report**.

---

## 1. Architecture & View Flow

### View States (Managed by `CoachSection.tsx`)
| View | Route | Purpose |
|------|-------|---------|
| `plan` | `/coach` | Weekly AI-generated workout plan with day selection |
| `library` | `/coach/library` | Exercise library browser with equipment filtering |
| `camera` | `/coach/prepare` | Camera readiness checks & video upload/analysis |
| `session` | `/coach/session` | Active workout with live tracking & manual logging |
| `report` | `/coach/report` | Post-workout summary with exercise breakdown |

### State Persistence
- **Server-authoritative**: Workout sessions stored in MongoDB with revision-based concurrency control
- **Device drafts**: Unsaved set inputs persisted to `localStorage` per workout (`physiquequest-workout-draft:{apiUrl}:{userId}:{workoutId}`)
- **Recovery system**: On app reopen, checks for active workouts and offers resume
- **Session storage**: Last completed workout ID stored for report navigation

---

## 2. AI Coach Plan Generation (`CoachPlan.tsx`, `coach-planner.ts`)

### Plan Inputs (from User Profile)
- **Goal**: Build muscle, Strength, Weight loss, Endurance, General fitness
- **Training days**: Selected weekdays (defaults to 3 sessions/week spread Mon/Wed/Fri)
- **Session duration**: 20/30/45/60 min → determines exercises per workout (3/4/6/8)
- **Equipment**: Bodyweight, Dumbbell, Barbell, Cable, Machine, Full gym, etc.
- **Health conditions**: Knee injury, Lower back pain, Shoulder impingement, Hypertension, Asthma → triggers exercise exclusions

### Planning Algorithm
1. **Equipment filtering**: Keeps exercises matching user equipment (Bodyweight always allowed)
2. **Condition exclusions**: Removes exercises matching contraindicated keywords
3. **Focus rotation**: Goal-specific focus areas rotate across sessions (e.g., Push/Pull/Legs for Build Muscle)
4. **Movement prioritization**: Prefers compound movements, distinct movement families first
5. **Set/rep prescription**: Goal-specific schemes (3×10 hypertrophy, 4×6 strength, 3×15 weight loss, etc.)
6. **Form tips**: Auto-attached from exercise instructions for key movements (press/squat/row/deadlift)

### Plan Output Structure
```typescript
CoachPlanRecord {
  goal: string
  weekLabel: string        // "Week 3 · 3 sessions planned"
  sessionCount: number
  duration: string
  libraryReady: boolean
  sets: string             // Default prescription e.g. "3 × 10"
  days: CoachDay[7]        // One per weekday
}
```

---

## 3. Camera Check & Live Feed (`CameraCheck.tsx`, `useCameraStream.ts`, `useCameraReadiness.ts`)

### Two Modes: Live Feed & Video Upload

#### A. Live Camera Feed Mode
**Camera Stream Features:**
- Front/back camera switching
- Native preview optimization (Expo/React Native WebView)
- Auto-start on session entry
- Permission handling with fallback messaging

**Real-Time Readiness Checks (4 checks):**
| Check | What It Validates | Status Values |
|-------|-------------------|---------------|
| **Camera Connection** | Frames arriving, not stale | `ready` / `adjust` / `unknown` |
| **Full Body in Frame** | 17 key landmarks visible (head, shoulders, hips, knees, ankles) | `ready` / `adjust` / `unknown` |
| **Scene Brightness** | Luminance within calibrated band | `ready` / `adjust` (dim/bright) / `unknown` |
| **Framing** | Body upright, height in [55%, 85%] of frame, not clipped | `ready` / `adjust` / `unknown` |

**Readiness Policy:**
- Confidence threshold: 0.65 landmark visibility
- Margin from frame edge: 4%
- Dwell time for stability: 1000ms
- Expiry: 1250ms without fresh evidence
- Sampling: 200ms intervals
- Initialization timeout: 10s
- Inference timeout: 5s

**Implementation:**
- Runs on-device via Web Worker (`pose.worker.ts`) using MediaPipe Pose
- No images uploaded during readiness checks
- Falls back gracefully if Web Worker/ImageBitmap/OffscreenCanvas unavailable
- Native bridge receives observations from Expo app for native camera

#### B. Video Upload & Analysis Mode
**Upload Constraints:**
- Formats: MP4, MOV (video/mp4, video/quicktime)
- Max size: 20 MB
- Max duration: 2 minutes (120 seconds)
- Local preview with duration detection

**Analysis Pipeline:**
1. File → base64 encoding (client-side)
2. POST `/pose/analyze` with:
   - `mediaBase64`: Base64 video
   - `mimeType`: video/mp4 | video/quicktime
   - `analysisType`: 'workout'
   - `durationSeconds`: ceil(video duration)
   - `exerciseHint`: 'chest_press' | 'squat' (optional)

**Analysis Report Contents (`AnalysisReport` component):**
- **Exercise Identification**: AI-estimated exercise, equipment, body area, specific muscles
- **Movement Estimate**: Estimated reps from joint-angle cycles
- **Joint Angle Ranges**: Min/max angles per joint with visible frame count
- **Form Observations**: Technique notes
- **Possible Corrections**: Specific feedback items
- **Instructions**: Step-by-step movement guide
- **Disclaimer**: "AI feedback is unverified and may miss important details. Review with a qualified coach; analysis cannot determine whether form is safe."

---

## 4. Live Session Tracking (`LiveSession.tsx`, `RoutineSession.tsx`)

### Core Session Features
- **Exercise timer**: Real-time elapsed display (MM:SS)
- **Camera preview**: Live video with facing toggle
- **Inactivity monitoring**: Native + web-based movement detection
- **Pause/Resume**: Server-synced with revision control
- **Manual set logging**: Reps, weight, duration with rest timers
- **Exercise navigation**: Swipe/list selection with progress tracking

### Inactivity Detection & Safety System

#### Detection Mechanism
- **Native (Expo)**: Accelerometer-based monitoring via `ReactNativeWebView` bridge
- **Web**: Pose-based movement detection (when camera active)
- **Threshold**: Configurable per user settings (default from `settings.threshold`)

#### Three-Phase Escalation
| Phase | Trigger | Behavior |
|-------|---------|----------|
| **Active** | Normal workout | Camera running, timer counting |
| **Countdown** | No movement for `thresholdSeconds` | 30s visual countdown ring, "I'm okay" button cancels |
| **Alarm** | Countdown expires | Loud alarm sound, emergency alert sent to contact |

#### Emergency Alert System
- **Contact**: User-configured name + phone (from profile)
- **Location**: GPS coordinates included when available (native)
- **Delivery**: POST `/safety/alerts` with idempotency key
- **Status tracking**: `pending` → `delivered` | `failed` | `cancelled`
- **Resolution**: 3-second hold-to-stop button prevents accidental dismissal
- **Admin view**: Recent 30-day alert log for administrators

#### Native Bridge Events
```typescript
// From native to web
{ type: 'countdown-started' }
{ type: 'cancelled', reason: 'movement' | 'im-okay' }
{ type: 'alarm-started', nativeAudio: boolean }
{ type: 'alarm', location: { lat, lng, accuracyMeters, capturedAt } }
{ type: 'stopped' }
{ type: 'motion-status', available: boolean }

// From web to native
{ type: 'inactivity-start', thresholdMs }
{ type: 'inactivity-stop' }
{ type: 'inactivity-request-motion-status' }
{ type: 'inactivity-hold-stop' }
{ type: 'inactivity-im-okay' }
```

### Manual Workout Logging (`RoutineSession.tsx`)
- **Per-set inputs**: Reps (1-1000), Weight (0-1000 kg / 2204 lbs)
- **Unit toggle**: kg ↔ lbs with automatic conversion
- **Prescription parsing**: "3 × 10" → 3 sets of 10 reps; "3 × 45 s" → timed holds
- **Rest timers**: Between sets (default 90s) and exercises (default 120s)
- **Skip exercise**: Marks all remaining sets as skipped
- **Draft persistence**: Auto-saves to localStorage on every input change
- **Conflict handling**: 409 responses trigger reload with server state

---

## 5. PoseTracker Integration (Form Analysis) (`PoseTrackerSession.tsx`, `PoseTrackerEntry.tsx`)

### Three Tracking Modes

#### A. Built-in Provider Tracking
- **Provider**: PoseTracker (posetracker.com)
- **Exercises**: 40+ pre-mapped (squat, push_up, plank, lunge, deadlift, etc.)
- **Camera orientation**: Front or side per exercise
- **Capabilities**: Repetition counting + provider feedback
- **Validation**: Documentation-mapped → verified by admin

#### B. Reference-Based Tracking
- **Custom reference**: Admin records a reference movement in PoseTracker dashboard
- **UUID-based**: Genuine PoseTracker reference UUID required
- **Output**: Similarity scores (NCC, DTW, timing, distance)
- **Verification**: Admin must test and mark verified

#### C. Generated-Angle Tracking (Local/Offline)
- **Source**: GIF analysis pipeline extracts joint angle profiles
- **Config**: `GeneratedAngleConfig` with start/peak angles, directions, stability constraints
- **Runtime**: `GenericRepCounter` class (pure TypeScript, runs in Web Worker)
- **Joints tracked**: MediaPipe 33 landmarks (left/right knee, elbow, shoulder, hip, ankle)
- **State machine**: AT_START → MOVING → AT_PEAK → RETURNING → AT_START
- **Fault detection**: Stability constraints (e.g., knee valgus, hip shift)
- **Device tier adaptation**: Low/medium/high FPS, angle thresholds, battery awareness

### PoseTracker Session Flow
1. **Configuration fetch**: GET `/pose-tracker/exercises/:id` → `TrackingConfig`
2. **Launch request**: POST `/pose-tracker/exercises/:id/launch` → returns token + config
3. **Embedded iframe**: Loads `https://app.posetracker.com` with token
4. **Message bridge**: Receives `progression`, `angles`, `counter`, `exercise_summary`, `error`, `keypoints`
5. **Local counter**: Also runs `GenericRepCounter` for generated-angle mode
6. **Summary**: Rep count, progression %, form scores, similarity metrics

### Tracking Configuration Schema (`exercise-registry.ts`)
```typescript
TrackingConfig {
  exerciseId: string
  name: string
  trackingMode: 'builtin' | 'reference' | 'generated-angle' | 'unavailable'
  providerExerciseId?: string        // For builtin
  referenceUuid?: string             // For reference
  generatedAngleConfig?: GeneratedAngleConfig
  cameraOrientation: 'front' | 'side' | 'reference' | 'pending'
  capabilities: string[]             // ['repetitions','provider-feedback'] etc.
  validationStatus: 'documentation-mapped' | 'pending' | 'verified' | 'disabled'
  limitations: string[]              // Always includes: "Camera cannot assess pain, injury risk or equipment load"
}
```

### Admin Configuration
- **Coverage audit**: GET `/admin/pose-tracker/coverage` → full catalog mapping report
- **Config override**: PUT `/admin/pose-tracker/exercises/:id` with validation
- **Test launch**: POST `/admin/pose-tracker/exercises/:id/test` (bypasses verification)
- **Verification requirements**: Provider test evidence + camera setup + notes

---

## 6. Local Rep Tracking (`useRepTracking.ts`, `useGenericRepTracking.ts`, `repCounter.ts`, `genericRepCounter.ts`)

### Squat/Curl Counter (`repCounter.ts`)
- **Exercises**: Bodyweight squat (partially supported), Standing biceps curl (requires special setup)
- **Landmarks**: Hip-knee-ankle (squat) or Shoulder-elbow-wrist (curl)
- **Side selection**: Left or right (user chooses)
- **Angle thresholds**:
  - Squat: Straight 155°, Bent 105°, Partial 145°
  - Curl: Straight 155°, Bent 65°
- **Timing**: Dwell 150ms, Min bent 300ms, Max gap 600ms
- **Output**: Rep count, phase, observation (detected/adjustment/unknown), status message

### Generic Angle Counter (`genericRepCounter.ts`)
- **Input**: `GeneratedAngleConfig` from GIF analysis
- **Joints**: Any MediaPipe joint (knee, elbow, shoulder, hip, ankle)
- **Side modes**: Bilateral, Unilateral, Alternating, Unknown
- **Progress normalization**: (current - start) / (peak - start)
- **Full range threshold**: 85% (device-tier adjustable)
- **Fault detection**: Stability constraints with 250ms persistence
- **Visibility handling**: 500ms grace period, then VISIBILITY_LOST state
- **Battery awareness**: Reduces FPS at 20% battery, critical at 10%

### Web Worker Pipeline
Both counters run pose estimation in a Web Worker:
1. `init` → loads MediaPipe Pose model
2. `frame` / `generic-frame` → receives ImageBitmap, returns landmarks
3. Main thread runs counter logic on landmark data
4. 50ms frame interval (adaptive based on inference duration)

---

## 7. Video Analysis (Server-Side) (`api.analyzePose`)

### Endpoint: POST `/pose/analyze`
**Input:**
```typescript
PoseAnalysisInput {
  mediaBase64: string
  mimeType: 'video/mp4' | 'video/quicktime' | 'image/jpeg' | 'image/png'
  analysisType?: 'workout' | 'readiness'
  requestedChecks?: ('fullBodyInFrame' | 'lighting' | 'distance')[]
  durationSeconds?: number
  exerciseHint?: 'chest_press' | 'squat'
}
```

**Output (AnalysisReport displays):**
- `metrics`: sampledFrames, detectedFrames, durationSeconds, joints[]
- `joints`: { joint, minAngle, maxAngle, visibleFrames }[]
- `observations`: string[]
- `exerciseReview`: { exercise, equipment, generalBodyPart, specificMuscles, formObservations[], corrections[], instructions[], estimatedReps }
- `movementEstimate`: { estimatedReps }

---

## 8. Workout Report (`WorkoutReport.tsx`)

### Report Sections

#### Hero
- Status badge: "Workout complete" / "Workout saved"
- Date & time started
- Session title

#### Overview Metrics
| Metric | Calculation |
|--------|-------------|
| **Duration** | `endedAt - startedAt - pausedSeconds` (MM:SS) |
| **Sets Logged** | Completed / Expected (if planned) |
| **Volume** | Σ(reps × loadKg) for completed sets with weight |

#### Exercise Breakdown
Per exercise:
- Set-by-set detail: Set number, reps/duration, weight (or "Bodyweight / no load")
- Status: Completed / Skipped
- Exercise result summary (from `exerciseResults`): Total reps, max load

---

## 9. Exercise Library (`ExerciseLibrary.tsx`)

### Features
- **Search & filter**: By muscle, equipment, body part
- **Equipment filter**: Uses profile equipment as default
- **PoseTracker entry**: "PoseTracker options" button opens `PoseTrackerEntry` dialog
- **Squat preview**: Direct link to `SquatFormPreview` for bodyweight squat
- **Exercise cards**: Name, equipment, target muscle, GIF demo, tracking badge

---

## 10. Data Models (Backend)

### WorkoutSession (`workout-session.schema.ts`)
```typescript
{
  userId: ObjectId
  exerciseIds: string[]
  exercises: WorkoutExerciseSnapshot[]  // Planned exercise details
  sets: WorkoutSetResult[]              // Actual logged sets
  exerciseResults: ExerciseResult[]     // Aggregated per-exercise totals
  startedAt: Date
  endedAt?: Date
  pausedAt?: Date
  pausedSeconds: number
  durationSeconds?: number
  status: 'active' | 'completed'
  origin: 'planned' | 'standalone' | 'recorded-set'
  revision: number          // Optimistic locking
  programVersion?: string   // Coach plan hash
  dayIndex?: number
  scheduledDate?: string
  activityDate?: string
  appliedRecordingIds: string[]  // For recorded-set application
}
```

### WorkoutSetResult
```typescript
{
  setId: string           // "{exerciseId}:{setIndex}"
  exerciseId: string
  setIndex: number
  reps: number
  durationSeconds?: number
  loadKg?: number
  status: 'completed' | 'skipped'
  source: 'manual' | 'local-video'
  sourceRecordingId?: string  // Links to recorded-set origin
}
```

---

## 11. API Endpoints (Coach & Workouts)

### Coach
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/coach/status` | Service health + attribution |
| GET | `/coach/plan` | Get user's AI-generated plan |
| POST | `/coach/plan` | Independent plan generation (no auth) |

### Workouts
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/workouts` | Create workout (planned/standalone/recorded) |
| GET | `/workouts` | List recent workouts |
| GET | `/workouts/active` | Get active workout for recovery |
| GET | `/workouts/:id` | Get workout detail |
| PATCH | `/workouts/:id/sets` | Save/update a set |
| PATCH | `/workouts/:id/pause` | Pause/resume workout |
| POST | `/workouts/:id/complete` | Complete workout |

### PoseTracker
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/pose-tracker/exercises/:id` | Get tracking config |
| POST | `/pose-tracker/exercises/:id/launch` | Get provider token |
| POST | `/pose-tracker/configurations` | Batch config fetch |
| PUT | `/admin/pose-tracker/exercises/:id` | Save admin override |
| POST | `/admin/pose-tracker/exercises/:id/test` | Admin test launch |
| GET | `/admin/pose-tracker/coverage` | Catalog coverage audit |

### Pose Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/pose/status` | Check analysis availability |
| POST | `/pose/analyze` | Analyze uploaded video |

---

## 12. Safety & Privacy Considerations

### Camera & Video
- **Live feed**: Processed on-device (Web Worker), no upload during readiness checks
- **PoseTracker iframe**: Third-party service; camera frames processed per their privacy policy
- **Video upload**: Base64 sent to `/pose/analyze`; sampled frames may go to Google Gemini for exercise review
- **No frame retention**: PhysiqueQuest does not store camera frames from any session
- **Consent dialog**: Explicit checkbox before PoseTracker session starts

### Inactivity Alerts
- **Location**: Only shared when available (native GPS)
- **Contact notification**: Best-effort delivery via configured provider
- **Idempotency**: Each alert uses unique key to prevent duplicates

### Data Handling
- **Workout data**: User-owned, stored in MongoDB with userId index
- **Draft data**: Device-only localStorage, never synced to server
- **Revision control**: Optimistic locking prevents lost updates

---

## 13. Device Compatibility & Fallbacks

### Required Browser APIs
| Feature | Required APIs | Fallback |
|---------|---------------|----------|
| Camera stream | `getUserMedia` | Manual logging only |
| Pose estimation | `Worker`, `createImageBitmap`, `OffscreenCanvas` | "Count reps manually" |
| Video frame callback | `requestVideoFrameCallback` | `setInterval` polling |
| Native bridge | `ReactNativeWebView` | Web-only mode |

### Device Tier Detection (`genericRepCounter.ts`)
- **Low**: Older Android, iOS < 12 → 5 FPS, conservative thresholds
- **Medium**: Most phones → 10 FPS, standard thresholds
- **High**: Flagships → 15 FPS, tighter thresholds
- **Battery awareness**: Reduces FPS at 20%, critical at 10%

---

## 14. Key Implementation Files

### Frontend (React/Next.js)
```
frontend/sections/Coach/
├── CoachSection.tsx          # Main orchestrator, view routing, recovery
├── CoachPlan.tsx             # Weekly plan display, day selection
├── CameraCheck.tsx           # Camera readiness + video upload/analysis
├── LiveSession.tsx           # Active session with inactivity monitoring
├── RoutineSession.tsx        # Manual logging UI + LiveSession embed
├── WorkoutReport.tsx         # Post-workout summary
├── PoseTrackerSession.tsx    # PoseTracker iframe + local counter
├── PoseTrackerEntry.tsx      # Dialog launcher for PoseTracker
├── SquatFormPreview.tsx      # Local squat/curl counter demo
├── GenericTrackingSession.tsx# Generated-angle local tracking
├── InactivityViews.tsx       # Countdown + Emergency alarm UI
├── ExerciseLibrary.tsx       # Browse exercises with filters
├── workoutRoutine.ts         # Snapshot/prescription helpers
├── posetracker.css           # PoseTracker styles
├── workout-report.css        # Report styles
├── coach-reference.css       # Shared Coach styles
├── libraryreference.css      # Library styles
└── CameraCheck.tsx           # Camera check component

frontend/hooks/
├── useCoachPlan.ts           # Plan data fetching
├── useWorkouts.ts            # Workout mutations
├── useCameraStream.ts        # Camera access + preview
├── useCameraReadiness.ts     # Readiness checks orchestration
├── useRepTracking.ts         # Squat/curl counter hook
├── useGenericRepTracking.ts  # Generated-angle counter hook
└── useSettings.ts            # User settings (threshold, etc.)

shared/
├── repCounter.ts             # Squat/curl counting logic
├── genericRepCounter.ts      # Generic angle counter (core)
├── cameraReadiness.ts        # Readiness evaluation + controller
└── workoutRoutine.ts         # Shared routine helpers
```

### Backend (NestJS)
```
backend/src/
├── coach/
│   ├── coach.service.ts      # Plan generation + caching
│   ├── coach.controller.ts   # GET /coach/plan, /coach/status
│   ├── coach-planner.ts      # Planning algorithm
│   ├── movement-curation.ts  # Exercise selection rules
│   └── coach-program.schema.ts # Cached program persistence
├── pose-tracker/
│   ├── pose-tracker.module.ts # Service + controllers + admin
│   ├── exercise-registry.ts  # Config resolution + validation
│   └── pose-tracker-rate-limit.guard.ts
├── workouts/
│   ├── workouts.service.ts   # CRUD + pause/complete + recorded sets
│   ├── workouts.controller.ts
│   ├── schemas/workout-session.schema.ts
│   └── workout-contract.ts   # Types + calendar logic
└── exercises/
    ├── exercisedb.service.ts # Exercise catalog
    └── catalog-sync.service.ts
```

---

## 15. Current Limitations & Disclaimers

### Form Analysis
- **Not medical advice**: Cannot assess pain, injury risk, or safe technique
- **Unverified AI**: Exercise review and rep estimates require human verification
- **2D only**: Camera cannot assess depth, 3D alignment, or load
- **Visibility dependent**: Occluded joints, poor lighting, or framing reduce accuracy

### Tracking Coverage
- **Built-in**: ~40 exercises mapped to PoseTracker
- **Generated-angle**: Requires GIF analysis pipeline + admin verification
- **Reference**: Requires admin-recorded PoseTracker reference + verification
- **Unavailable**: Most exercises fall back to manual logging

### Inactivity Detection
- **Web**: Requires camera + pose estimation (heavy)
- **Native**: Accelerometer-based (lightweight, always available in app)
- **Threshold**: Single global setting per user (not per-exercise)

---

## 16. Future Enhancement Opportunities

1. **Per-exercise inactivity thresholds** (isometric vs dynamic)
2. **Multi-angle camera support** (front + side simultaneous)
3. **Offline pose model caching** (Service Worker + IndexedDB)
4. **Real-time form cues** during live session (not just post-analysis)
5. **Exercise-specific rest timer presets**
6. **Video recording** of live sessions for later review
7. **Trainer/coach review workflow** for form analysis reports
8. **Progressive overload suggestions** based on workout history
9. **Integration with wearable HR/HRV** for readiness scoring
10. **Automatic exercise detection** from video (no hint required)

---

*Document generated from codebase analysis as of 2026. Covers all Coach Section features across frontend, backend, and shared logic.*