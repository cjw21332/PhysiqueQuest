# Native vs. Web PoseTracker Parity Analysis

**Date:** 2026-11-07  
**Purpose:** Compare event models, capabilities, and UX between native (React Native SDK) and web (iframe) paths

---

## Executive Summary

| Dimension | Web (Iframe) | Native (RN SDK) | Parity |
|-----------|--------------|-----------------|--------|
| **Event Schema** | Provider-defined postMessage | SDK callbacks + custom overlay | 🟡 Partial |
| **Rep Counting** | Provider counter events | Provider counter + local A/B filter | 🟡 Extended |
| **Form Feedback** | Provider form_score, recommendation | Provider grades + 2D angles | 🟡 Extended |
| **Skeleton/Keypoints** | Events received, **not rendered** | Real-time skeletal overlay | 🔴 Gap |
| **Reference Similarity** | Provider similarity events | **Not implemented** | 🔴 Gap |
| **Session Summary** | Provider exercise_summary | Local metrics only | 🔴 Gap |
| **Camera Control** | Provider-managed (opaque) | App-managed (Expo Camera) | 🟡 Different |
| **Lifecycle** | Iframe mount/unmount | SDK warmup/start/stop | 🟡 Different |
| **Background Handling** | Pagehide/unload → cleanup | AppState → full restart | 🟡 Different |
| **Token Handling** | In iframe URL (exposed) | In native memory (secure) | 🟢 Native wins |

---

## Event Model Comparison

### Web: Provider postMessage Events (from `bridge.ts`)

```typescript
type ProviderEvent =
  | { type: 'initialization'; payload: { status: 'ready' | 'error'; message?: string } }
  | { type: 'counter'; payload: { count: number; grade?: 'A' | 'B' | 'C'; timestamp?: number } }
  | { type: 'form_score'; payload: { score: number; maxScore: 100; details?: Record<string, number> } }
  | { type: 'progression'; payload: { phase: string; progress: 0-1; repProgress?: 0-1 } }
  | { type: 'recommendation'; payload: { message: string; priority: 'low' | 'medium' | 'high' } }
  | { type: 'posture'; payload: { joint: string; status: 'good' | 'warning' | 'bad'; angle?: number } }
  | { type: 'keypoint'; payload: { landmarks: Array<{ x: number; y: number; z?: number; visibility: number }> } }
  | { type: 'angle'; payload: { joint: string; value: number; confidence: number } }
  | { type: 'error'; payload: { code: string; message: string; recoverable: boolean } }
  | { type: 'exercise_summary'; payload: { 
      totalReps: number; 
      gradedReps: { A: number; B: number; C: number };
      avgFormScore: number;
      durationSeconds: number;
      similarity?: number;  // reference mode only
    } };
```

### Native: SDK Callbacks + Local Overlay (from `PoseTrackerNative.tsx`)

```typescript
// SDK Events (from PoseTracker React Native SDK)
type SDKEvent =
  | { type: 'onInitialized'; payload: { exerciseId: string } }
  | { type: 'onRepDetected'; payload: { count: number; grade: 'A' | 'B' | 'C'; timestamp: number } }
  | { type: 'onFormScore'; payload: { score: number; details: Record<string, number> } }
  | { type: 'onProgression'; payload: { phase: string; progress: number } }
  | { type: 'onRecommendation'; payload: { message: string } }
  | { type: 'onPosture'; payload: { joint: string; status: string; angle: number } }
  | { type: 'onKeypoints'; payload: { landmarks: Landmark[] } }  // raw, per-frame
  | { type: 'onError'; payload: { code: string; message: string } };

// Local Overlay Computations (PoseTrackerNative.tsx)
interface LocalMetrics {
  // Skeletal overlay from keypoints (confidence > 0.5)
  skeleton: {
    points: Map<string, { x: number; y: number; visibility: number }>;
    connections: Array<[string, string]>;
  };
  // 2D angles computed locally
  angles: {
    leftKnee: number | null;
    rightKnee: number | null;
    leftElbow: number | null;
    rightElbow: number | null;
  };
  // Rep grading: only A/B counted locally
  abRepCount: number;           // incremented on grade A/B
  totalRepCount: number;        // from SDK onRepDetected
  // Session timer (local)
  elapsedSeconds: number;
}
```

### Event Mapping Table

| Provider Event | Web Handler | Native Handler | Parity |
|----------------|-------------|----------------|--------|
| `initialization` | `bridge.ts` → `status: 'ready'` | `onInitialized` → `setReady(true)` | ✅ Full |
| `counter` | `bridge.ts` → `counters` state | `onRepDetected` → `totalRepCount++` + grade filter | 🟡 Native adds local A/B filter |
| `form_score` | `bridge.ts` → `formScores` array | `onFormScore` → `formScores` array | ✅ Full |
| `progression` | `bridge.ts` → throttled 10Hz | `onProgression` → `progression` state | ✅ Full |
| `recommendation` | `bridge.ts` → `recommendations` array | `onRecommendation` → `recommendations` array | ✅ Full |
| `posture` | `bridge.ts` → `posture` map | `onPosture` → `posture` map + local angles | 🟡 Native adds 2D angles |
| `keypoint` | `bridge.ts` → validated, **not stored** | `onKeypoints` → skeletal overlay + angles | 🔴 Web discards; Native renders |
| `angle` | `bridge.ts` → throttled 4Hz | Computed locally from keypoints | 🟡 Different source |
| `error` | `bridge.ts` → `errors` array + UI | `onError` → `errors` array + UI | ✅ Full |
| `exercise_summary` | `bridge.ts` → `summary` state | **Not received** — local summary only | 🔴 Gap |

---

## Capability Matrix

| Capability | Web | Native | Notes |
|------------|-----|--------|-------|
| **Camera Selection** | Provider UI (opaque) | App UI (front/back toggle) | Native superior |
| **Camera Preview** | Provider iframe (opaque) | Expo Camera view + overlay | Native superior |
| **Skeleton Visualization** | ❌ Not implemented | ✅ Real-time canvas | **Major gap** |
| **Keypoint History** | ❌ Discarded | ❌ Not stored (per-frame only) | Both gap |
| **3D Landmarks (z)** | ✅ In keypoint events | ❌ SDK may not provide | Web advantage |
| **Reference Similarity** | ✅ Provider events | ❌ Not implemented | **Major gap** |
| **Session Summary** | ✅ Provider authoritative | ❌ Local approximation | Web authoritative |
| **Offline/Intermittent** | ❌ Iframe fails | ⚠️ SDK may cache | Unknown |
| **Multi-Exercise Session** | ❌ New iframe per exercise | ❌ SDK restart per exercise | Both gap |
| **Audio/Cues** | Provider may provide | ❌ Not implemented | Unknown |
| **Accessibility** | Provider responsibility | App responsibility | Different |

---

## UX Flow Comparison

### Web Flow
```
1. User clicks "Start Tracking" on exercise
2. Frontend POST /launch → gets { iframeUrl, token }
3. Dialog opens → iframe.src = iframeUrl
4. Provider iframe loads → requests camera permission
5. Provider initializes → sends 'initialization: ready'
6. Web shows "Ready" → user positions self
7. Provider streams events → bridge validates → UI updates
8. User clicks "Stop" → iframe removed → summary shown
9. User manually logs workout (reps, weight, RPE)
```

### Native Flow
```
1. User clicks "Start Tracking" on exercise (in WebView)
2. Frontend resolves config → if builtin:
3. WebView.postMessage('posetracker-native-start', { token, exerciseId, name })
4. Native host receives → stops webcam preview
5. Native host opens PoseTrackerNative screen
6. Native requests camera permission (Expo)
7. SDK warms up (~2-3s) → onInitialized
8. Native shows camera + skeletal overlay
9. User exercises → SDK callbacks → overlay updates
10. User taps "Stop" → SDK stops → screen closes
11. Native host resumes webcam preview
12. WebView receives... nothing (no summary passed back) ❌
13. Web shows "Session ended" but no data
```

### Critical UX Gaps

| Gap | Impact | Fix Effort |
|-----|--------|------------|
| **No summary return from native** | Web shows empty session; user can't review | Medium (WebView postMessage back) |
| **No skeleton on web** | Web feels inferior; no visual feedback | High (canvas overlay + keypoint stream) |
| **No reference similarity on native** | Reference mode unusable on mobile | Medium (SDK support needed) |
| **Camera permission double-prompt** | Web asks, then native asks again | Low (coordinate permissions) |
| **WebView ↔ Native transition jank** | 2-3s blank screen during handoff | Medium (pre-warm SDK) |
| **Background handling different** | Web: pause; Native: restart | Low (align behavior) |

---

## Data Flow Integration Points

### Current: One-Way (Web → Native)
```
Web (launch) → WebView.postMessage('posetracker-native-start') → Native
```

### Required: Two-Way (Native → Web)
```typescript
// In PoseTrackerNative.tsx, on stop:
const summary = {
  type: 'posetracker-native-summary',
  payload: {
    totalReps: totalRepCount,
    abReps: abRepCount,
    formScores: formScores,           // array from SDK
    avgFormScore: avgFormScore,
    durationSeconds: elapsedSeconds,
    angles: angleHistory,             // if stored
    similarity: null,                 // not available yet
  }
};
window.ReactNativeWebView.postMessage(JSON.stringify(summary));
```

```typescript
// In WebView message handler (mobile/App.tsx or bridge):
onMessage = (event) => {
  const data = JSON.parse(event.nativeEvent.data);
  if (data.type === 'posetracker-native-summary') {
    // Feed into same session state as web iframe
    bridge.injectNativeSummary(data.payload);
  }
};
```

---

## Synchronization Requirements

| Requirement | Current | Target |
|-------------|---------|--------|
| **Session Identity** | Separate (web session vs native session) | Single `sessionId` passed through |
| **Token Sharing** | Token in iframe URL + passed to native | Single token source (backend) |
| **Exercise Config** | Resolved twice (web + native) | Resolved once, passed through |
| **Event Schema** | Provider events vs SDK events | Normalized to common `PoseTrackerEvent` |
| **Summary Format** | Provider authoritative vs local | Provider format preferred; native mirrors |
| **Error Codes** | Provider codes vs SDK codes | Mapped to common `PoseTrackerErrorCode` |

---

## Recommended Unification Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PoseTrackerSession (React)               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Web Path   │  │ Native Path │  │  Common State       │  │
│  │  (iframe)   │  │ (WebView)   │  │  (context/reducer)  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         ▼                ▼                     ▼             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PoseTrackerEventBus                    │   │
│  │  normalize(providerEvent) → commonEvent             │   │
│  │  normalize(sdkEvent) → commonEvent                  │   │
│  │  normalize(nativeSummary) → commonEvent             │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SessionReducer                         │   │
│  │  state: { status, counters, formScores, progression, │   │
│  │           recommendations, posture, angles,         │   │
│  │           skeleton?, summary, errors }              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Common Event Schema (Proposed)
```typescript
interface PoseTrackerEvent {
  source: 'web' | 'native';
  sessionId: string;
  exerciseId: string;
  timestamp: number;
  type: 
    | 'initialized'
    | 'rep_detected'      // { count, grade?, timestamp }
    | 'form_score'        // { score, maxScore, details }
    | 'progression'       // { phase, progress, repProgress }
    | 'recommendation'    // { message, priority }
    | 'posture'           // { joint, status, angle }
    | 'keypoints'         // { landmarks[] } — optional, for skeleton
    | 'angle'             // { joint, value, confidence }
    | 'error'             // { code, message, recoverable }
    | 'summary'           // { totalReps, gradedReps, avgFormScore, duration, similarity? }
}
```

---

## Implementation Roadmap

### Phase 1: Native → Web Summary Return (1 week)
- [ ] Add `posetracker-native-summary` postMessage in `PoseTrackerNative.tsx`
- [ ] Handle in WebView message listener (`mobile/App.tsx`)
- [ ] Feed into `PoseTrackerSession` state via `bridge.injectSummary()`
- [ ] Test: native session → web shows summary

### Phase 2: Common Event Normalization (2 weeks)
- [ ] Create `PoseTrackerEventBus` (singleton or context)
- [ ] Migrate `bridge.ts` web normalization to bus
- [ ] Add SDK event normalization in native → bus
- [ ] Single `SessionReducer` for both paths
- [ ] Test: identical UI state from web vs native

### Phase 3: Web Skeleton Overlay (2 weeks)
- [ ] Enable keypoint rendering in web (canvas overlay on iframe)
- [ ] Throttle keypoints to ~10Hz (match native)
- [ ] Draw COCO skeleton + confidence-based visibility
- [ ] Compute 2D angles locally (knee, elbow) for parity
- [ ] Test: web shows skeleton like native

### Phase 4: Native Reference Similarity (Provider dependent)
- [ ] Request SDK support for reference mode + similarity events
- [ ] Implement similarity display in native overlay
- [ ] Normalize to common `summary.similarity`

### Phase 5: Unified Camera Permission (1 week)
- [ ] Single permission request at session start
- [ ] Share camera stream between web/native (if possible)
- [ ] Or: coordinate so only one prompts

### Phase 6: Session Identity & Analytics (1 week)
- [ ] Generate `sessionId` at launch, pass to both paths
- [ ] Include in all events, summary, telemetry
- [ ] Backend: single session record per user workout

---

## Testing Parity Matrix

| Test Case | Web | Native | Both Must Pass |
|-----------|-----|--------|----------------|
| Launch → initialized → ready | ☐ | ☐ | ✅ |
| 10 reps → counter increments | ☐ | ☐ | ✅ |
| Form scores per rep | ☐ | ☐ | ✅ |
| Progression updates | ☐ | ☐ | ✅ |
| Recommendations shown | ☐ | ☐ | ✅ |
| Posture warnings | ☐ | ☐ | ✅ |
| Skeleton visible | ☐ | ☐ | ✅ |
| 2D angles displayed | ☐ | ☐ | ✅ |
| Stop → summary received | ☐ | ☐ | ✅ |
| Summary matches ground truth | ☐ | ☐ | ✅ |
| Background → foreground | ☐ | ☐ | ✅ |
| Camera switch | ☐ | ☐ | ✅ |
| Error recovery | ☐ | ☐ | ✅ |
| Reference mode (if configured) | ☐ | ☐ | ✅ |

---

## Decision: Which Path for Which User?

| User Context | Recommended Path | Rationale |
|--------------|------------------|-----------|
| **Desktop browser** | Web (iframe) | No native app; full screen |
| **Mobile browser (PWA)** | Web (iframe) | No install; camera access works |
| **Installed iOS app** | Native | Better performance, overlay, offline potential |
| **Installed Android app** | Native | Same |
| **Reference mode** | Web (until native supports) | Provider similarity events only on web |
| **Multi-exercise workout** | Web (for now) | Native requires full restart per exercise |
| **Accessibility needs** | Web | Provider may have better a11y; native is custom |

**Long-term:** Native should reach full parity + exceed web (offline, lower latency, better UX). Web remains fallback and reference-mode path.

---

## Metrics to Track Parity

| Metric | Web Target | Native Target | Measurement |
|--------|------------|---------------|-------------|
| **Init Latency** | <20s | <10s (warm) / <15s (cold) | Telemetry |
| **Rep Count MAE** | ≤0.5 | ≤0.5 | Phase 2 validation |
| **Form Grade κ** | ≥0.7 | ≥0.7 | Phase 2 validation |
| **Frame Latency (p95)** | N/A | <150ms | Phase 4 native |
| **Session Completion** | >85% | >85% | Phase 3 field |
| **User Rating** | ≥4.0 | ≥4.2 | Phase 3 field |
| **Crash Rate** | <0.5% | <0.5% | Sentry/Crashlytics |

---

*End of Parity Analysis. This completes the 4-document set for PoseTracker validation readiness.*