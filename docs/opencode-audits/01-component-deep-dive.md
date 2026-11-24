# PoseTracker Component Deep-Dive

**Date:** 2026-11-07  
**Source:** Handoff document analysis + repository inspection  
**Purpose:** Technical deep-dive into the four core integration components

---

## 1. Bridge Message Validation (`frontend/services/poseTracker/bridge.ts`)

### Architecture
```
Provider iframe → postMessage → bridge.ts (validate → normalize → reduce) → React state
```

### Validation Pipeline (Exact Sequence)

```typescript
// 1. Origin check — must match POSETRACKER_ORIGIN constant
if (event.origin !== POSETRACKER_ORIGIN) return;

// 2. Source check — must be the current iframe's contentWindow
if (event.source !== iframeRef.current?.contentWindow) return;

// 3. Type guard — known event types only
const knownTypes = [
  'initialization', 'counter', 'form_score', 'progression',
  'recommendation', 'posture', 'keypoint', 'angle', 'error', 'exercise_summary'
];
if (!knownTypes.includes(event.data?.type)) return;

// 4. Payload shape validation — per-type Zod schemas (or equivalent)
//    e.g., counter: { count: number, grade?: 'A'|'B'|'C' }
//    e.g., angle: { joint: string, value: number, confidence: number }

// 5. Rate limiting — progression ~10Hz, angles ~4Hz
//    Implemented via timestamp maps per event type

// 6. Staleness rejection — keypoints >1.5s old dropped (native path)
//    Web path: no explicit staleness check, relies on provider timestamps

// 7. Size limits — payloads >64KB rejected (defense-in-depth)
```

### Event Normalization Output
```typescript
interface NormalizedEvent {
  type: string;
  payload: unknown;           // validated, typed payload
  timestamp: number;          // Date.now() at receipt
  sequence: number;           // monotonically increasing per session
}
```

### State Reduction
- **SessionState** (React context): `status`, `counters`, `formScores`, `progression`, `recommendations`, `posture`, `angles`, `keypoints`, `errors`, `summary`
- **Derived metrics**: `abRepCount` (grades A/B only), `totalRepCount`, `latestFormScore`, `readiness`
- **No raw keypoint history retained** — intentional privacy/performance choice

### Critical Observations
| Aspect | Finding |
|--------|---------|
| **Origin constant** | Hardcoded to `https://tracker.poseprovider.com` — must match provider dashboard |
| **No replay protection** | Sequence numbers prevent reordering but not replay; consider nonce per session |
| **Error events** | Parsed but not surfaced to user with actionable guidance |
| **CPU/WASM fallback** | Treated as non-fatal `info` event — good, but no UI indication |
| **Keypoint streaming** | Validated but not rendered — skeleton drawing happens only in native path |

### Test Coverage Gaps
- ❌ Malformed origin with valid payload
- ❌ Valid origin, wrong `contentWindow` (iframe swap attack)
- ❌ Payload just over 64KB boundary
- ❌ Rapid-fire progression events (throttle stress)
- ❌ Provider sends `initialization` twice (idempotency)

---

## 2. Native Frame Pipeline (`mobile/PoseTrackerNative.tsx`)

### Data Flow
```
Expo Camera (capture) → resize(longest ≤256px) → JPEG/base64 → PoseTracker RN SDK
                                    ↓
                          delete temp files (original + resized)
                                    ↓
                          SDK callback → skeletal overlay + angles + rep events
```

### Key Implementation Details

| Parameter | Value | Rationale / Risk |
|-----------|-------|------------------|
| **Max dimension** | 256px | Reduces bandwidth/compute; may lose small-joint detail |
| **JPEG quality** | Not specified (default ~0.8) | Tradeoff: size vs. landmark accuracy |
| **Frame interval target** | 100ms (10 FPS) | Aggressive for mobile; thermal throttling likely |
| **Staleness threshold** | 1.5s | Reasonable; drops frames if inference backs up |
| **Overlap prevention** | `isProcessing` flag | Single-threaded JS; inference on native thread |
| **Camera switch** | Front/back toggle | Stops SDK, reinitializes — ~2s gap |
| **Background handling** | `AppState` listener → stop SDK | Correct; but no "pause/resume" — full restart |

### Skeletal Overlay Rendering
```typescript
// Confidence threshold for drawing points: 0.5 (hardcoded)
// Connections: COCO 17-point skeleton pairs
// Angles: 2D knee (hip-knee-ankle) + elbow (shoulder-elbow-wrist)
// Grade display: Only A/B reps counted; C/un-graded ignored
```

### Memory/Resource Profile (Estimated)
| Resource | Per Frame | 10-min Session |
|----------|-----------|----------------|
| Temp files | 2 × ~15KB JPEG | 18,000 files → cleanup critical |
| Base64 string | ~20KB | 120MB allocated/GC'd |
| SDK inference | ~30-50ms (est.) | Sustained CPU ~30-40% |
| Battery | ~5-8%/hr (est.) | Needs measurement |

### Critical Gaps
1. **No frame-drop metrics exposed** — can't tell if 100ms target met
2. **No thermal state monitoring** — iOS/Android thermal APIs unused
3. **JPEG quality not configurable** — may need tuning per device tier
4. **SDK warm-up time unmeasured** — user sees blank screen during init
5. **No "paused" state** — backgrounding destroys session entirely
6. **Angle calculation 2D only** — no depth, same limitation as MediaPipe PoC

---

## 3. Exercise Registry (`backend/src/pose-tracker/exercise-registry.ts`)

### Resolution Logic
```typescript
function resolveConfig(exerciseId: string): TrackingConfig | null {
  // 1. Check MongoDB overrides (exerciseposetrackerconfigs)
  const override = await configCollection.findOne({ exerciseId });
  if (override) return override;

  // 2. Fall back to built-in mapping table (15 entries)
  return BUILTIN_MAPPINGS[exerciseId] || null;
}
```

### Schema (MongoDB `exerciseposetrackerconfigs`)
```typescript
interface ExercisePoseTrackerConfig {
  _id: ObjectId;
  exerciseId: string;           // unique, indexed
  mode: 'builtin' | 'reference';
  builtinExerciseId?: string;   // e.g., 'squat', 'push_up'
  referenceUuid?: string;       // UUID v4, validated
  orientation?: 'portrait' | 'landscape';
  status: 'draft' | 'verified' | 'disabled';
  limitations: string[];        // e.g., ['unilateral', 'cable_machine']
  verificationEvidence: {
    testedBy: string;
    testedAt: Date;
    notes: string;
    videoRef?: string;          // optional reference recording
  };
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;            // admin user ID
}
```

### Built-in Mapping Table (15 entries → 9 provider IDs)
| Provider ID | Catalog Exercises (examples) |
|-------------|------------------------------|
| `squat` | Barbell Back Squat, Goblet Squat, Front Squat |
| `push_up` | Push-Up, Incline Push-Up, Decline Push-Up |
| `lunge` | Walking Lunge, Reverse Lunge, Bulgarian Split Squat* |
| `calf_raise` | Standing Calf Raise, Seated Calf Raise |
| `glute_bridge` | Glute Bridge, Hip Thrust* |
| `bicep_curl` | Dumbbell Bicep Curl, Hammer Curl* |
| `hammer_curl` | (mapped separately but same provider ID?) |
| `lateral_raise` | Dumbbell Lateral Raise, Cable Lateral Raise* |
| `mountain_climber` | Mountain Climber |

*Equipment/camera-angle variants that may not work with same provider ID

### Admin Override Validation Rules
| Field | Validation |
|-------|------------|
| `referenceUuid` | UUID v4 regex, checked against provider test endpoint |
| `mode` | Enum: `builtin` \| `reference` |
| `status` | Enum: `draft` \| `verified` \| `disabled` |
| `limitations` | Free-form array; not enforced at runtime |
| `verificationEvidence` | Required for `verified` status; attestation only |

### Critical Issues
1. **No versioning** — Overwrites lose history; no audit trail of config changes
2. **`hammer_curl` duplicate** — Appears as separate provider ID but likely same as `bicep_curl`
3. **Unilateral exercises** — `bulgarian_split_squat` mapped to `lunge`; occlusion risk high
4. **Machine exercises** — Cable lateral raise mapped to `lateral_raise`; cable occludes limbs
5. **No "requires_multiple_angles" flag** — 552 exercises flagged in audit but not modeled

---

## 4. Launch Endpoint & Token Flow (`backend/src/pose-tracker/pose-tracker.module.ts`)

### Endpoint: `POST /api/pose-tracker/exercises/:id/launch`

```typescript
@Post('exercises/:id/launch')
@UseGuards(AuthGuard)
async launch(@Param('id') exerciseId: string, @Req() req: Request) {
  // 1. Authenticate user
  const user = req.user;

  // 2. Resolve config
  const config = await this.registry.resolveConfig(exerciseId);
  if (!config) throw NotFoundException('No tracking configuration');

  // 3. Check eligibility
  if (config.status !== 'verified') throw ForbiddenException('Not verified');

  // 4. Read provider token from env
  const token = process.env.POSETRACKER_API_TOKEN;
  if (!token) throw ServiceUnavailableException('Provider not configured');

  // 5. Return launch payload
  return {
    iframeUrl: this.buildIframeUrl(config, token),
    token,                    // ⚠️ RETURNED TO FREND
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,  // 24h (not enforced by provider)
    exerciseName: await this.catalog.getName(exerciseId),
  };
}
```

### Iframe URL Construction
```typescript
buildIframeUrl(config: TrackingConfig, token: string): string {
  const base = 'https://tracker.poseprovider.com/embed';
  const params = new URLSearchParams({
    token,
    exercise: config.mode === 'builtin' ? config.builtinExerciseId! : config.referenceUuid!,
    mode: config.mode,
    orientation: config.orientation || 'portrait',
  });
  return `${base}?${params.toString()}`;
}
```

### Security Analysis

| Layer | Status | Risk |
|-------|--------|------|
| **Transport** | HTTPS only | ✅ |
| **Auth** | JWT session cookie | ✅ |
| **Token in response** | `private, no-store` headers | ✅ |
| **Token in iframe URL** | **Visible in DevTools Network tab** | 🔴 **Critical** |
| **Token lifetime** | 24h claimed, not enforced | 🟡 Unknown |
| **Token scope** | Full account access (assumed) | 🔴 **Critical** |
| **Origin restriction** | None on provider side (assumed) | 🟡 |

### Token Exposure Attack Vectors
1. **Authenticated user** → Opens DevTools → Copies token → Uses in own iframe
2. **XSS in PhysiqueQuest** → Steals token from launch response
3. **Referer header** → Iframe loads third-party resources → Token in Referer
4. **Browser history** → URL with token saved in history

### Mitigations Needed
- [ ] Request **short-lived signed iframe tokens** from provider (JWT, 5-10 min TTL)
- [ ] Implement **token proxy endpoint** — frontend calls `/proxy/token` → backend mints short-lived token → returns only to frontend memory
- [ ] Add **Content-Security-Policy: frame-src** to restrict iframe origin
- [ ] **Never log** token (audit backend logs)
- [ ] **Rotate** `POSETRACKER_API_TOKEN` regularly; monitor provider dashboard for anomalous usage

---

## Cross-Component Integration Points

| Connection | Mechanism | Contract |
|------------|-----------|----------|
| Frontend → Backend launch | `POST /api/pose-tracker/exercises/:id/launch` | Returns `{ iframeUrl, token, exerciseName }` |
| Frontend → Iframe | `iframe.src = iframeUrl` | Token in URL query param |
| Iframe → Frontend | `postMessage` | Validated by `bridge.ts` |
| Frontend (WebView) → Native | `window.ReactNativeWebView.postMessage('posetracker-native-start', payload)` | `{ token, exerciseId, exerciseName }` |
| Native → Frontend | None (results stay in native overlay) | **Gap** — no summary passed back |
| Admin → Backend | REST CRUD on `/api/admin/pose-tracker/*` | Standard JSON |

---

## Files to Inspect for Verification

```bash
# Bridge validation
frontend/services/poseTracker/bridge.ts

# Native pipeline
mobile/PoseTrackerNative.tsx
mobile/App.tsx (WebView message handler)

# Registry
backend/src/pose-tracker/exercise-registry.ts
backend/src/pose-tracker/pose-tracker.module.ts

# Admin UI
frontend/sections/Admin/PoseTrackerReferences.tsx (assumed path)

# Types
shared/poseTrackerTypes.ts (if exists)
```

---

## Summary: Where the Bodies Are Buried

| Component | Biggest Risk | Quick Win |
|-----------|--------------|-----------|
| **Bridge** | No replay protection, no keypoint rendering | Add nonce per session; expose keypoint stream optionally |
| **Native** | No frame-drop/thermal metrics, full restart on background | Add `useFrameMetrics` hook; implement pause/resume |
| **Registry** | No versioning, unilateral/machine mappings unvalidated | Add config version field; flag high-risk exercises |
| **Launch/Token** | Token exposed in iframe URL | **Priority 1**: Request short-lived tokens from provider |

---

*End of Deep-Dive. See `02-validation-plan.md` for empirical validation strategy.*