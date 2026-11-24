# PoseTracker Live Validation Plan

**Date:** 2026-11-07  
**Status:** DRAFT — Requires provider token before execution  
**Goal:** Convert "integration framework" → "evidence-backed feature"

---

## Phase 0: Prerequisites (Blockers)

| Item | Owner | Done? | Notes |
|------|-------|-------|-------|
| Dedicated provider account with commercial terms | Product | ❌ | Free plan reportedly prohibits commercial use |
| `POSETRACKER_API_TOKEN` in backend env (staging) | DevOps | ❌ | Must be real, not placeholder |
| Provider dashboard access for token management | DevOps | ❌ | Need to request short-lived token API |
| Staging environment with HTTPS + camera permissions | DevOps | ✅ | Assume existing |
| Test devices: iOS (2), Android (2), Desktop Chrome/Firefox/Safari | QA | ❌ | Physical devices required |
| Consented test participants (5-10) | Product/Legal | ❌ | IRB/consent forms needed |
| Ground-truth labeling protocol | Research | ❌ | Define before data collection |

**Go/No-Go Gate:** All Phase 0 items ✅ before Phase 1.

---

## Phase 1: Smoke Test — "Does It Turn On?"

**Duration:** 1-2 days  
**Scope:** Single exercise (`squat` — built-in, well-understood)  
**Environment:** Staging, desktop Chrome + one iOS + one Android device

### Test Matrix

| Test Case | Web (Desktop) | Web (Mobile Browser) | Native (iOS) | Native (Android) |
|-----------|---------------|---------------------|--------------|------------------|
| 1. Launch → iframe loads → init event received | ☐ | ☐ | N/A | N/A |
| 2. Camera permission granted → preview visible | ☐ | ☐ | ☐ | ☐ |
| 3. Provider readiness event within 45s | ☐ | ☐ | ☐ (SDK warmup) | ☐ (SDK warmup) |
| 4. Perform 5 controlled squats → counter increments | ☐ | ☐ | ☐ | ☐ |
| 5. Form score events received | ☐ | ☐ | ☐ | ☐ |
| 6. Progression events received | ☐ | ☐ | ☐ | ☐ |
| 7. Stop session → summary event received | ☐ | ☐ | ☐ | ☐ |
| 8. Cleanup: iframe removed / SDK stopped | ☐ | ☐ | ☐ | ☐ |
| 9. Re-launch same exercise (no cache issues) | ☐ | ☐ | ☐ | ☐ |
| 10. Background/foreground (native) | N/A | N/A | ☐ | ☐ |

### Success Criteria (All Must Pass)
- [ ] Initialization event within 45s on all 4 platforms
- [ ] Camera preview visible and stable
- [ ] Counter increments correctly for 5 deliberate reps (±1 tolerance)
- [ ] At least one form_score event per rep
- [ ] No console errors / unhandled promise rejections
- [ ] Session summary includes rep count, duration, form scores
- [ ] Native: skeletal overlay visible, angles update
- [ ] Native: background → foreground restarts cleanly

### Instrumentation
```typescript
// Add to bridge.ts temporarily
console.log('[VALIDATION]', {
  event: 'init_received',
  latencyMs: Date.now() - sessionStartTime,
  platform: isNative ? 'native' : 'web',
  device: getDeviceInfo(),
});

// Add to native
console.log('[VALIDATION]', {
  event: 'frame_processed',
  latencyMs: captureToOverlayMs,
  frameNumber,
  dropped: isDropped,
});
```

### Deliverable: `phase1-smoke-report.md`
- Per-platform pass/fail table
- Latency measurements (init, first frame, first counter)
- Screenshots of each platform working
- Blocker list for Phase 2

---

## Phase 2: Accuracy Validation — "Does It Count Right?"

**Duration:** 1-2 weeks  
**Scope:** 5 exercises × 3 participants × 3 camera positions = 45 sessions  
**Environment:** Staging, controlled lighting, tripod-mounted phones

### Exercise Selection (Priority Order)
| Exercise | Provider ID | Why | Equipment | Risk |
|----------|-------------|-----|-----------|------|
| Barbell Back Squat | `squat` | Baseline, bilateral, full body | Barbell, rack | Low |
| Push-Up | `push_up` | Horizontal, floor occlusion | None | Medium (wrist angle) |
| Walking Lunge | `lunge` | Unilateral, movement | None | High (occlusion) |
| Dumbbell Bicep Curl | `bicep_curl` | Upper body, isolated | Dumbbells | Low |
| Glute Bridge | `glute_bridge` | Supine, hip-focused | None | Medium (knee visibility) |

### Camera Positions (Per Exercise)
| Position | Description | Rationale |
|----------|-------------|-----------|
| **Front** | 45° front-side, 2m distance, hip height | Standard for most exercises |
| **Side** | 90° lateral, 2m distance, hip height | Best for depth/angle (squat, lunge) |
| **Angled** | 30° front-side, 1.5m, chest height | "Selfie" position — realistic user behavior |

### Protocol Per Session
1. **Setup** — Device on tripod, lighting >500 lux, plain background
2. **Calibration** — Participant stands in frame, confirms visibility
3. **Warm-up** — 2 practice reps (not recorded)
4. **Recorded Set** — 10 reps at controlled tempo (2s down, 1s up)
5. **Variations** — 3 fast reps, 3 slow reps, 3 partial ROM reps
6. **Ground Truth** — Second observer counts reps live + video review

### Metrics to Capture

| Metric | Source | Target |
|--------|--------|--------|
| **Rep Count Accuracy** | Provider counter vs. ground truth | ±0 reps (exact) or ±1 (acceptable) |
| **Rep Timing Latency** | Provider timestamp vs. video frame | <500ms |
| **Form Score Distribution** | Provider grades (A/B/C) per rep | Correlation with human rater (κ >0.7) |
| **False Positives** | Provider counts during rest | 0 |
| **False Negatives** | Missed reps (ground truth - provider) | 0 |
| **Tracking Loss Events** | Provider `error` + gap >3s | 0 per 10-rep set |
| **Init Latency** | Launch → readiness event | <30s (stretch: <15s) |
| **Frame Rate (Native)** | Capture-to-overlay timestamps | ≥8 FPS sustained |

### Data Collection Template
```csv
session_id,exercise,provider_id,platform,participant,camera_pos,rep_num,
ground_truth_time,provider_time,provider_count,provider_grade,
form_score,progression,tracking_lost,notes
```

### Statistical Analysis Plan
- **Primary:** Mean absolute error (MAE) in rep count per exercise
- **Secondary:** Cohen's κ between provider grades and human rater (3 raters, blinded)
- **Exploratory:** Latency vs. device tier, camera position, movement speed

### Success Criteria (Per Exercise)
| Exercise | Rep MAE | Grade κ | Tracking Loss | Init Latency |
|----------|---------|---------|---------------|--------------|
| Squat | ≤0.5 | ≥0.7 | 0/10 | <20s |
| Push-Up | ≤1.0 | ≥0.6 | ≤1/10 | <25s |
| Lunge | ≤1.5 | ≥0.5 | ≤2/10 | <30s |
| Bicep Curl | ≤0.5 | ≥0.7 | 0/10 | <20s |
| Glute Bridge | ≤1.0 | ≥0.6 | ≤1/10 | <25s |

### Deliverable: `phase2-accuracy-report.md`
- Per-exercise accuracy tables
- Bland-Altman plots (provider vs. ground truth)
- Grade agreement matrices
- Failure mode catalog with video clips
- Go/No-Go for Phase 3

---

## Phase 3: Real-World Conditions — "Does It Work in the Wild?"

**Duration:** 2-3 weeks  
**Scope:** 10 participants, 2 weeks unsupervised, own devices/homes

### Conditions Matrix (Stratified Sampling)
| Factor | Levels | Target N |
|--------|--------|----------|
| **Device Tier** | Flagship (iPhone 15/Pixel 8), Mid (iPhone 13/Pixel 7), Budget (SE/A54) | 3/3/4 |
| **Body Type** | BMI <25, 25-30, >30 | 3/4/3 |
| **Lighting** | Bright (>500 lux), Dim (100-300 lux), Mixed | Natural distribution |
| **Background** | Plain, Cluttered, Outdoor | Natural distribution |
| **Clothing** | Fitted, Loose, Long sleeves/pants | Natural distribution |
| **Camera** | Front, Back | 50/50 |

### Protocol
1. **Onboarding** — 30-min guided session (calibration, tips)
2. **Free Use** — Participants use PoseTracker for 5+ workouts over 2 weeks
3. **Daily Check-in** — Brief survey: "Did it work? Any issues?"
4. **Automatic Telemetry** (opt-in) — Session duration, errors, counter values
5. **Exit Interview** — 15-min structured debrief

### Telemetry Schema (Append to Backend)
```typescript
interface TelemetryEvent {
  sessionId: string;
  userId: string;           // hashed
  exerciseId: string;
  platform: 'web' | 'native' | 'web-mobile';
  deviceTier: 'flagship' | 'mid' | 'budget';
  startTime: Date;
  endTime: Date;
  repCount: number;
  formScores: number[];     // per-rep
  errors: string[];         // provider error codes
  trackingLossCount: number;
  initLatencyMs: number;
  avgFrameLatencyMs?: number;  // native only
  cameraPosition: 'front' | 'back';
  userRating?: 1-5;         // post-session prompt
}
```

### Success Criteria
| Metric | Target |
|--------|--------|
| **Session Completion Rate** | >80% of started sessions reach summary |
| **User Rating** | Median ≥4/5 |
| **Critical Error Rate** | <5% of sessions (init failure, crash, no events) |
| **Tracking Loss** | <10% of sessions have >1 loss event |
| **Rep Count Plausibility** | 95% of sessions within expected range for exercise |

### Deliverable: `phase3-field-report.md`
- Completion funnel analysis
- Error taxonomy with frequencies
- Device-tier performance breakdown
- User qualitative feedback themes
- Go/No-Go for production release

---

## Phase 4: Native Deep Dive — "Is the Pipeline Sustainable?"

**Duration:** 1 week (parallel with Phase 3)  
**Scope:** Instrumented native builds on 6 devices (3 iOS, 3 Android)

### Instrumentation Required
```typescript
// Add to PoseTrackerNative.tsx
interface FrameMetrics {
  timestamp: number;
  captureMs: number;        // camera.capture()
  resizeMs: number;         // ImageManipulator
  jpegMs: number;           // base64 encode
  sdkInferenceMs: number;   // SDK callback
  overlayRenderMs: number;  // skeletal draw
  totalMs: number;
  dropped: boolean;         // >100ms target
  thermalState?: 'nominal' | 'fair' | 'serious' | 'critical';  // iOS/Android API
  batteryDelta?: number;    // per 100 frames
}
```

### Test Protocol
| Test | Duration | Conditions |
|------|----------|------------|
| **Sustained Load** | 20 min continuous | Squats, 10 FPS target |
| **Thermal Ramp** | Until throttle | Max brightness, heavy exercise |
| **Background Cycles** | 10× bg/fg | 30s bg, 60s fg |
| **Camera Switch** | 20× front/back | During active session |
| **Memory Pressure** | 30 min + other apps | Simulate real usage |

### Metrics to Capture
| Metric | Target | Alert If |
|--------|--------|----------|
| **Avg Frame Latency** | <100ms (p50), <150ms (p95) | p95 >200ms |
| **Drop Rate** | <5% | >10% |
| **Thermal Throttle Time** | 0 min (first 10 min) | Any |
| **Battery Drain** | <10%/hr | >15%/hr |
| **Memory Growth** | <50MB over 20 min | >100MB |
| **Restart Success** | 100% | Any failure |

### Deliverable: `phase4-native-report.md`
- Frame latency distributions per device
- Thermal/battery curves
- Memory profiles
- Crash/restart logs
- Optimization recommendations (JPEG quality, frame skip, SDK config)

---

## Phase 5: Reference Mode Validation — "Do Custom References Work?"

**Duration:** 1 week  
**Prerequisite:** Provider dashboard access to create reference movements

### Protocol
1. **Create 3 References** in provider dashboard:
   - "Perfect Squat" (expert demo)
   - "Modified Push-Up" (knees)
   - "Single-Leg RDL" (unilateral)
2. **Configure in Admin UI** — Save UUIDs, mark verified
3. **Test Each** — 3 participants × 3 reps × 2 camera positions
4. **Measure** — Similarity scores vs. ground truth (expert rating)

### Success Criteria
- [ ] Reference UUID accepted by launch endpoint
- [ ] Provider returns `similarity` events
- [ ] Similarity correlates with expert rating (ρ >0.6)
- [ ] No crashes on reference-mode launch

### Deliverable: `phase5-reference-report.md`

---

## Consolidated Timeline

```
Week 1:     Phase 0 (blockers) + Phase 1 (smoke)
Week 2-3:   Phase 2 (accuracy) — controlled lab
Week 3-5:   Phase 3 (field) + Phase 4 (native) — parallel
Week 5:     Phase 5 (reference)
Week 6:     Consolidation, go/no-go decision, production hardening
```

**Total: ~6 weeks with dedicated QA + 1 developer + 5-10 participants**

---

## Resource Requirements

| Role | Allocation | Duration |
|------|------------|----------|
| QA Lead | 100% | 6 weeks |
| Developer (instrumentation/fixes) | 50% | 6 weeks |
| DevOps (staging, tokens, telemetry) | 25% | Week 1, then as needed |
| Participants | 5-10 people | 2-3 hrs each (Phases 1-2), 2 weeks (Phase 3) |
| Devices | 6 physical (3 iOS, 3 Android) | Full duration |
| Provider Support | Ad-hoc | Token issues, reference creation, quota |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Provider token not available | High | Blocking | Escalate to provider sales; have mock fallback for UI dev |
| Provider quota exceeded | Medium | Delay | Monitor dashboard; request higher quota upfront |
| Participants no-show | Medium | Delay | Recruit 2x; compensate well; flexible scheduling |
| Native crashes on specific device | High | Data loss | Test matrix covers tiers; capture crash logs |
| Accuracy worse than expected | Medium | Rework | Define "minimum viable" thresholds upfront |
| Commercial terms unacceptable | Low | Project pivot | Legal review before Phase 0 complete |

---

## Go/No-Go Decision Framework

| Gate | Criteria | Decision |
|------|----------|----------|
| **After Phase 1** | All 4 platforms smoke-test pass | Proceed / Fix blockers / Abort |
| **After Phase 2** | ≥3/5 exercises meet accuracy targets | Proceed / Scope down / Abort |
| **After Phase 3** | Completion >80%, rating ≥4, critical errors <5% | Proceed / Iterate / Abort |
| **After Phase 4** | No thermal crashes, battery <10%/hr, drops <10% | Proceed / Optimize / Abort native |
| **Final** | All gates green + legal/commercial clear | **Ship** / **Delay** / **Pivot** |

---

## Deliverables Summary

| Phase | Report | Artifacts |
|-------|--------|-----------|
| 1 | `phase1-smoke-report.md` | Screenshots, latency table, blocker list |
| 2 | `phase2-accuracy-report.md` | CSV data, statistical analysis, failure videos |
| 3 | `phase3-field-report.md` | Telemetry dashboard, user quotes, error taxonomy |
| 4 | `phase4-native-report.md` | Frame profiles, thermal curves, optimization PRs |
| 5 | `phase5-reference-report.md` | Similarity validation, admin UI screenshots |
| **Final** | `VALIDATION_SUMMARY.md` | Go/no-go recommendation, production checklist |

---

## Next Immediate Actions

1. [ ] **Today:** Request provider token + commercial terms clarification
2. [ ] **Today:** Provision staging env with token
3. [ ] **Day 2:** Run Phase 1 smoke test on desktop Chrome (30 min)
4. [ ] **Day 3:** Recruit participants (internal team first for Phase 1-2)
5. [ ] **Day 4:** Add telemetry schema to backend (migration)
6. [ ] **Day 5:** Instrument native build with frame metrics

---

*This plan assumes a dedicated provider token is obtainable. If not, Phase 0 becomes a commercial negotiation track with unknown timeline.*

*End of Validation Plan. See `03-token-security-audit.md` for token exposure analysis.*