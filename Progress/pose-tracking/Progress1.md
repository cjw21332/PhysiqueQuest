# Phase 1: Read Before Coding - Summary

**Date:** 2026-11-07  
**Task:** GIF-derived pose configs and generic angle-based rep counter for PhysiqueQuest

---

## 1. Backend PoseTracker Registry (`backend/src/pose-tracker/exercise-registry.ts`)

### Key Types
- **`CatalogExercise`**: Raw catalog record with `exerciseId`/`_id`, `name`, `bodyParts`, `targetMuscles`, `equipments`, `instructions`, `equipment`, `targetMuscle`, `group`
- **`TrackingConfig`**: Resolved configuration with:
  - `trackingMode`: `'builtin' | 'reference' | 'unavailable'`
  - `providerExerciseId`: e.g., `'squat'`, `'push_up'`, `'bicep_curl'`
  - `referenceUuid`: UUID for custom reference movements
  - `cameraOrientation`: `'front' | 'side' | 'reference' | 'pending'`
  - `validationStatus`: `'documentation-mapped' | 'pending' | 'verified' | 'disabled'`
  - `capabilities`: e.g., `['repetitions','provider-feedback']` or `['session-duration','provider-feedback']`
  - `category`: `'repetition' | 'isometric' | 'mobility' | 'machine-occlusion' | 'additional-camera-setup' | 'multiple-observations'`

### Resolution Logic
1. **Normalized name matching**: Exact match against `rules` array (15 rules)
2. **Equipment**: Must be exactly 1 item matching rule's equipment (e.g., `'bodyweight'`, `'dumbbell'`)
3. **Target muscles**: Regex match against `targetMuscles`
4. **Instructions**: Regex match against concatenated instructions
5. **Fallback**: `unavailable` mode with `validationStatus: 'pending'`

### Provider Exercises (allowlist)
```typescript
['squat','push_up','plank','lunge','side_lunge','deadlift','glute_bridge',
 'calf_raise','tricep_dip','bicep_curl','hammer_curl','shoulder_press',
 'lateral_raise','mountain_climber','high_knees','jumping_jack','low_impact_jack',
 'leg_raise','wall_sit','balance_leg','balance_leg_left','balance_leg_right',
 'shoulder_roll','shoulder_deep_breath','chair_forward_fold','chair_side_stretch',
 'split','facial_split','pancake','closing','bridge','cobra','bow','tiger',
 'camel','king_pigeon','foot_to_hand','i','needle','back_flexibility_test']
```

### Current Coverage (from audit)
- 1,500 catalog records, 1,500 unique IDs
- 15 built-in mappings (9 distinct provider IDs)
- 0 configured references, 0 awaiting verification
- 1,485 pending (need reference/config review)
- 552 need additional camera/occlusion/multiple-observation review
- 0 validated (live provider)

---

## 2. Backend Module (`backend/src/pose-tracker/pose-tracker.module.ts`)

### Storage
- **Collection**: `exerciseposetrackerconfigs` (Mongoose)
- **Schema**: `{ exerciseId: { unique: true }, config: Object, updatedBy: String, timestamps: true }`
- **Validation**: Zod schema + `validateOverride()` from registry

### API Endpoints
- `GET /api/pose-tracker/exercises/:id` - resolve config
- `POST /api/pose-tracker/configurations` - batch resolve (max 100 IDs)
- `POST /api/pose-tracker/exercises/:id/launch` - returns `{ config, token, developerOutputs }`
- Admin: `GET /api/admin/pose-tracker/coverage`, `PUT /admin/pose-tracker/exercises/:id`, `POST /admin/pose-tracker/exercises/:id/test`

### Launch Flow
1. Read `POSETRACKER_API_TOKEN` from env
2. Resolve config via registry + admin overrides
3. Check `canTrack()` (verified builtin or verified reference)
4. Return iframe URL with token in query param

---

## 3. Existing MediaPipe Prototype (`shared/repCounter.ts`, `frontend/hooks/useRepTracking.ts`, `frontend/workers/pose.worker.ts`)

### `shared/repCounter.ts`
- **TrackingKind**: `'squat' | 'curl'` (only 2 hardcoded exercises)
- **Landmark indices**: MediaPipe 33 landmarks, side-specific
  - Squat: left=[23,25,27] (hip,knee,ankle), right=[24,26,28]
  - Curl: left=[11,13,15] (shoulder,elbow,wrist), right=[12,14,16]
- **Angle calculation**: Aspect-corrected 2D angle using `(x * aspect, y)`
- **State machine**: `searching` → `ready` → `bent` → `ready` (counts on straight return)
- **Thresholds**: `straightAngle`, `bentAngle`, `dwellMs`, `minBentMs`, `maxGapMs`
- **Partial rep detection**: For squat only (`partialAngle`, `partialDwellMs`)
- **No fault detection, no visibility gating beyond min threshold**

### `frontend/hooks/useRepTracking.ts`
- Manages MediaPipe worker lifecycle
- Frame scheduling (adaptive 100-500ms interval)
- Stale frame handling (700ms timeout → reset)
- Native WebView bridge (`physiquequest-pose` events)

### `frontend/workers/pose.worker.ts`
- MediaPipe PoseLandmarker (lite model, CPU, VIDEO mode)
- Resizes frames to max 480px wide
- Outputs `TrackingFrame` with joints, aspect, timestamp
- Also supports `readiness-frame` for camera readiness check

---

## 4. PoseTracker Entry & Session (`frontend/sections/Coach/PoseTrackerEntry.tsx`, `PoseTrackerSession.tsx`)

### Entry Point
- `PoseTrackerEntry` - button opens dialog, fetches exercise, renders `PoseTrackerSession`
- `PoseTrackerSession` - full tracking UI with iframe, state machine, metrics

### Key Integration Points for New Mode
1. **Config resolution**: Uses `resolveTrackingConfig(exercise)` from registry
2. **Allowed check**: `canTrack(config)` - only verified builtin/reference
3. **Launch**: `api.launchPoseTracker(exerciseId, adminTest)` → returns token + config
4. **Native path**: If `ReactNativeWebView` + `builtin` mode → sends `posetracker-native-start` message
5. **Web path**: Creates iframe with `trackingUrl(config, token, ...)`
6. **Bridge**: `bridge.ts` validates origin + source, normalizes provider events
7. **UI**: Shows status, count, progression, form scores, reference similarity, angles, unsaved summary

### Adding a New Tracking Mode
Would need to:
1. Add `'generated-angle'` to `trackingMode` enum in registry + validation
2. Extend `resolveTrackingConfig` to return generated config when available
3. Update `canTrack()` to allow verified generated-angle configs
4. Update `trackingUrl()` in bridge.ts (no provider token needed for local)
5. Create new session component or extend `PoseTrackerSession` for local tracking
6. Wire MediaPipe worker + generic rep counter

---

## 5. ExerciseDB Catalog (Real Records)

### Raw Exercise Schema (from `exercisedb.service.ts`)
```typescript
type RawExercise = {
  exerciseId: string;      // e.g., "6YUfHPL"
  name: string;            // e.g., "quads (bodyweight squat)"
  gifUrl: string;          // URL to animated GIF
  bodyParts: string[];     // e.g., ["upper legs"]
  equipments: string[];    // e.g., ["bodyweight"]
  targetMuscles: string[]; // e.g., ["quadriceps"]
  secondaryMuscles: string[];
  instructions: string[];  // Step-by-step instructions
};
```

### Normalized Exercise (returned by `normalizeExercise`)
```typescript
{
  _id: string;              // exerciseId
  slug: string;             // exerciseId
  name: string;
  group: string;            // mapped body part group (Chest/Back/Legs/Core/Shoulders/Arms/Cardio)
  targetMuscle: string;     // same as group
  equipment: string;        // mapped equipment category (Dumbbells/Barbell/Bodyweight/etc.)
  bodyParts: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  gifUrl: string;
  instructions: string[];
  description: string;
  checks: string[];         // Form cues from instructions
  recommended: string;      // Default sets/reps
  trackingStatus: 'Manual';
  pose: 'missing';
  source: 'ExerciseDB V1';
}
```

### Sample Records (from coverage report)
| Exercise ID | Name | Mode | Provider ID |
|-------------|------|------|-------------|
| 6YUfHPL | quads (bodyweight squat) | builtin | squat |
| 3s4NnTh | dumbbell standing biceps curl | builtin | bicep_curl |
| 2NpxjC1 | dumbbell hammer curl | builtin | hammer_curl |
| 79AmJsI | dumbbell hammer curl | builtin | hammer_curl |
| I4hDWkc | push up | builtin | push_up |

### Distinct Enum Values (from `catalog-sync.service.ts` filters)

**Body Parts** (from `PARTS` mapping):
- chest, back, upper legs, lower legs, waist, shoulders, upper arms, lower arms, cardio

**Equipments** (from `EQUIPMENT` mapping):
- dumbbell, barbell, olympic barbell, EZ bar, trap bar, bodyweight, resistance band, cable, leverage machine, smith machine, sled machine, elliptical machine, stepmill machine, stationary bike, kettlebell

**Target Muscles** (raw from catalog - distinct values need DB query)

---

## 6. Documentation

### `docs/POSETRACKER_INTEGRATION.md`
- Implementation date: 2026-11-06
- Infrastructure complete, live provider verification pending
- 15 built-in mappings covering 9 provider IDs
- Zero live validation
- Privacy: no camera media stored, token in iframe URL (visible to authenticated user)
- Commercial use: free plan prohibits, paid plans permit

### `docs/REALTIME_FORM_POC.md`
- Historical MediaPipe squat prototype
- "Partially supported" - visibility ≥0.65, knee angle 155° straight / 105° bent
- Thresholds are uncalibrated heuristics
- No validated accuracy rate
- Fake-camera test: ~1168ms to readiness, inference ~22-217ms

---

## 7. Files to Create/Modify (Planned)

### Phase A: Offline GIF Analysis Pipeline (`tools/gif-config/`)
- `requirements.txt` - Python deps (mediapipe, numpy, scipy, opencv, pillow, tqdm, pymongo)
- `config.py` - All thresholds as constants
- `download_gifs.py` - Catalog download with rate limiting
- `extract_landmarks.py` - MediaPipe processing per frame
- `compute_angles.py` - Angle series computation
- `detect_cycles.py` - Primary joint detection, cycle finding
- `eligibility.py` - Status assignment with reason codes
- `generate_outputs.py` - JSON, CSV, review sheets
- `run_pipeline.py` - Main orchestrator
- `tests/test_angle_math.py`, `test_gap_interpolation.py`, `test_cycle_detection.py`

### Phase B: Persist Configs
- Extend `exercise-registry.ts`: add `'generated-angle'` mode
- Extend `pose-tracker.module.ts`: validation, import script
- Admin UI: show generated configs at `/admin/pose-tracker/references`
- Import script: `tools/gif-config/import_configs.py` with `--dry-run` default

### Phase C: Generic Live Counter
- `shared/genericRepCounter.ts` - Pure TS, framework-free
- Wire into web path using existing MediaPipe worker + camera hook
- UI: progress bar, rep count, partial count, cues, unsaved summary

### Phase D: Validation Harness
- Landmark recorder (consent + ground truth)
- `tools/eval/run_eval.ts` - Replay through counter, report metrics
- Interface definition for future classifier

---

## 8. Open Questions / Risks

1. **ExerciseDB Media Terms**: Must verify GIF download/cache rights before production
2. **2D from GIF vs User Camera**: GIF angle ranges may not match user's camera angle/view
3. **Threshold Tuning**: All thresholds are starting guesses; need real-person calibration
4. **Bilateral/Unilateral Detection**: Logic needs careful validation
5. **Stability Constraints**: Which joints to constrain per exercise type?
6. **View Hint Heuristic**: Shoulder-width vs torso-length ratio reliability?
6. **MongoDB Connection**: Need `EXERCISE_CATALOG_MONGODB_URI` for read-only access

---

## Next Steps

1. Create `tools/gif-config/` with Python pipeline
2. Test MongoDB connection and download a few GIFs
3. Run MediaPipe on sample GIFs to verify landmark extraction
4. Implement full pipeline with checkpointing
5. Generate coverage report and review sheets
6. **GATE A**: Present coverage summary + 10 review sheets before proceeding

---

*End of Progress1.md*