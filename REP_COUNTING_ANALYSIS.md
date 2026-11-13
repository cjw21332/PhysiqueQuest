# PhysiqueQuest Rep Counting Logic Analysis

## Executive Summary

After analyzing all four rep counting implementations, **there are critical architectural gaps** that prevent proper rep counting for real-world exercises, especially alternating movements like lunges. Each implementation was built for different purposes with incompatible assumptions.

---

## 1. Current Counting Logic Across Implementations

### A. `t4_rep_counter_v2.py` — Offline Benchmarking Script
**Purpose**: Evaluate rep counting accuracy on PushupBench dataset
**Approach**: State machine with explicit hysteresis thresholds

| Aspect | Implementation |
|--------|----------------|
| **State Machine** | 3 states: `up` → `down` → `up` (counts on exit) |
| **Smoothing** | Gaussian filter σ=2.0 |
| **Direction Detection** | Heuristic: compare first 10 vs last 10 frames mean angle |
| **Hysteresis** | Enter at 80% ROM, Exit at 20% ROM (60% gap) |
| **ROM Validation** | `min_rom_fraction=0.85` of expected ROM per rep |
| **Duration Filter** | 0.5s–4.0s per rep |
| **Joint Selection** | Fixed `PATTERN_JOINTS` dict → single joint triplet per pattern |
| **Side Handling** | **None** — always uses left-side joints (e.g., `[24,26,28]` = left knee) |

**Key Code** (lines 38–128):
```python
# Hysteresis thresholds
enter_thresh = start_angle - 0.8 * expected_rom  # 80% down
exit_thresh  = start_angle - 0.2 * expected_rom  # 20% down

# State machine
if state == "up" and angle <= enter_thresh: state = "down"
elif state == "down" and angle >= exit_thresh: count_rep_if_valid()
```

---

### B. `repCounter.ts` — Legacy Production Counter (React)
**Purpose**: Real-time counting for squat/curl only
**Approach**: Fixed-angle thresholds + dwell time (no true hysteresis)

| Aspect | Implementation |
|--------|----------------|
| **Exercises** | Only `squat` and `curl` |
| **Smoothing** | EMA α=0.35 |
| **State Machine** | `searching` → `ready` → `bent` → `ready` (counts on `bent`→`ready`) |
| **Thresholds** | Squat: straight≥155°, bent≤105° / Curl: straight≥155°, bent≤65° |
| **Dwell Time** | `dwellMs=150` (confirm state), `minBentMs=300` (min time in bent) |
| **Gap Reset** | `maxGapMs=600` — resets if frame gap too large |
| **Visibility** | `0.65` threshold |
| **Joint Selection** | `jointIndices(kind, side)` → picks left OR right, not both |
| **Side Handling** | **Manual only** — user must select left/right; no auto-detect |

**Key Code** (lines 51–92):
```typescript
const next = smoothed >= rule.straightAngle ? 'straight' :
             smoothed <= rule.bentAngle ? 'bent' : null;
// Counts rep when: phase==='bent' AND timestamp - bentAt >= minBentMs AND next==='straight'
```

---

### C. `genericRepCounter.ts` — Modern Generic Counter (TypeScript)
**Purpose**: Production-ready counter for arbitrary exercises via generated config
**Approach**: Normalized progress (0–1) with hysteresis-like thresholds

| Aspect | Implementation |
|--------|----------------|
| **State Machine** | `AT_START` → `MOVING` → `AT_PEAK` → `AT_START` (counts on return) |
| **Smoothing** | EMA α=0.35 (configurable) |
| **Progress Normalization** | `(angle - start) / (peak - start)` → 0=start, 1=peak |
| **Hysteresis** | `fullRangeThreshold=0.85` (must reach 85%), `startTolerance=0.2` (return within 20%) |
| **Duration Filter** | `minRepDurationMs=400`, `maxRepDurationMs=10000` |
| **Fault Detection** | Stability constraints on secondary joints (e.g., hip stability during squat) |
| **Visibility** | `visibilityThreshold=0.5`, `visibilityLostMaxMs=500` |
| **Side Modes** | `bilateral` \| `unilateral` \| `alternating` \| `unknown` (config-driven) |
| **Joint Selection** | `getPrimaryJoint()` → **first valid joint in `primaryJoints` array** |

**Key Code** (lines 498–562):
```typescript
case 'AT_START':
  if (progress > 0.05) { state = 'MOVING'; currentRepStartMs = timestamp; }
  break;
case 'MOVING':
  maxProgressInRep = max(maxProgressInRep, progress);
  if (progress >= fullThreshold) { state = 'AT_PEAK'; currentPeakMs = timestamp; }
  else if (progress <= startTol) { countPartialIfProgress>0.4; state = 'AT_START'; }
  break;
case 'AT_PEAK':
  if (progress <= startTol) {
    if (duration valid AND no faults) repCount++;
    state = 'AT_START';
  }
  break;
```

---

### D. `reps.py` — ML Pipeline Config Generator (Python)
**Purpose**: Generate exercise configs from GIF analysis for backend
**Approach**: Peak/valley detection via SciPy (offline, batch)

| Aspect | Implementation |
|--------|----------------|
| **Algorithm** | `scipy.signal.find_peaks` on smoothed signal |
| **Smoothing** | Moving average window=5 |
| **Direction** | Config-driven: `flexion` (valleys=reps) or `extension` (peaks=reps) |
| **Period Filter** | `rep_period_range=(0.8, 3.0)` seconds |
| **ROM Validation** | `min_rom_fraction=0.85` per rep segment |
| **Side Mode** | **Hardcoded `side_mode="bilateral"` for ALL exercises** |
| **Joint Selection** | Fixed `pattern_joints` dict → single triplet per pattern |
| **Angle Ranges** | Fixed `pattern_angles` dict (e.g., squat: 170°→90°) |

**Key Code** (lines 63–137):
```python
if config.direction == "flexion":
    rep_events = valleys  # bottom of squat
else:
    rep_events = peaks    # top of extension

# Filter by period
if min_period <= period <= max_period: valid_reps.append(idx)

# ROM check per rep
rom_fraction = rom / expected_rom
quality = "full" if rom_fraction >= config.min_rom_fraction else "partial"
```

---

## 2. What's Broken / Missing

### 🔴 Critical: Alternating Lunges Not Handled
| File | Issue |
|------|-------|
| `t4_rep_counter_v2.py` | Uses `[24,26,28]` (left knee only). Alternating lunges alternate left/right knee angles → signal oscillates wildly, state machine breaks. |
| `repCounter.ts` | Only supports squat/curl. No lunge config. Manual side selection only. |
| `genericRepCounter.ts` | Has `sideMode: 'alternating'` in config type, but `getPrimaryJoint()` **always picks first joint** — never switches sides. |
| `reps.py` | Hardcoded `side_mode="bilateral"` for lunges. Generates config for left knee only. |

**Root Cause**: No implementation tracks **which leg is moving** per frame. Alternating exercises need:
1. Per-frame side detection (which knee/hip/ankle is flexing)
2. Independent state machines per side, OR
3. A unified signal that combines both sides (e.g., min of left/right knee angle)

---

### 🔴 Critical: Joint Selection Is Rigid & Wrong for Many Exercises
| Exercise | Current Joint | Problem |
|----------|---------------|---------|
| **Lunge** | `[24,26,28]` (left knee) | Ignores right leg entirely |
| **Split Squat** | Same as lunge | Should track front leg only |
| **Single-Arm Row** | `[12,14,16]` (right arm) | Ignores left arm |
| **Single-Leg RDL** | `[24,26,28]` | Ignores stance leg stability |
| **All bilateral** | Single side only | Averages not computed; asymmetry not detected |

**No implementation** computes bilateral average or detects dominant side automatically.

---

### 🟠 Hysteresis Inconsistencies
| Implementation | Enter Threshold | Exit Threshold | Hysteresis Gap |
|----------------|-----------------|----------------|----------------|
| `t4_rep_counter_v2.py` | 80% ROM | 20% ROM | **60%** (good) |
| `repCounter.ts` | Fixed angle (e.g., 105°) | Fixed angle (e.g., 155°) | **Angle-based, not %ROM** (brittle) |
| `genericRepCounter.ts` | 85% progress | 20% progress | **65%** (good, but normalized) |
| `reps.py` | Peak prominence/distance | N/A (peak detection) | **None** (post-hoc filtering only) |

**Problem**: `repCounter.ts` (production) uses fixed angles that don't adapt to user ROM. A user with 140° straight knee never triggers "straight" state.

---

### 🟠 Visibility Thresholds Inconsistent
| File | Threshold | Notes |
|------|-----------|-------|
| `t4_rep_counter_v2.py` | Not checked per-frame | Relies on dataset quality |
| `repCounter.ts` | **0.65** | High — may drop valid frames |
| `genericRepCounter.ts` | **0.5** | Configurable, more permissive |
| `reps.py` | **0.5** (config) | Not enforced in `count_reps()` |

---

### 🟡 Min ROM Fraction: 0.85 Everywhere But Applied Differently
- `t4_rep_counter_v2.py`: Validates per-rep ROM against **expected ROM from signal**
- `genericRepCounter.ts`: Validates via `fullRangeThreshold=0.85` on **normalized progress**
- `reps.py`: Validates per-rep ROM against **config peak-start angle**
- `repCounter.ts`: **No ROM validation** — only angle thresholds + dwell time

---

### 🟡 No Tempo/Quality Feedback in Production Counters
- `reps.py` outputs tempo, ROM fraction, quality per rep
- `genericRepCounter.ts` emits `rep_counted` with `durationMs` but no ROM quality
- `repCounter.ts` only returns count + phase — no per-rep metrics
- `t4_rep_counter_v2.py` has detailed per-rep output but offline only

---

## 3. Required Fixes

### Fix 1: Alternating Exercise Support (Priority: CRITICAL)
**Files to modify**: `genericRepCounter.ts` (primary), `reps.py` (config generation)

**Approach A — Per-Side State Machines** (recommended):
```typescript
// In GenericRepCounter, when sideMode === 'alternating'
private sideStates: Map<string, SideState> = new Map(); // 'left' | 'right'

interface SideState {
  state: CounterState;
  repCount: number;
  currentRepStartMs: number;
  maxProgressInRep: number;
  lastActiveMs: number; // for side switching detection
}

// Per-frame: determine active side from angle deltas
private detectActiveSide(landmarks: Landmark[]): 'left' | 'right' | null {
  const leftKneeAngle = this.computeJointAngle(landmarks, 'left_knee', aspect);
  const rightKneeAngle = this.computeJointAngle(landmarks, 'right_knee', aspect);
  if (leftKneeAngle === null || rightKneeAngle === null) return null;

  // Side with larger angle change from start is active
  const leftDelta = Math.abs(leftKneeAngle - this.genConfig.startAngles.left_knee);
  const rightDelta = Math.abs(rightKneeAngle - this.genConfig.startAngles.right_knee);
  return leftDelta > rightDelta ? 'left' : 'right';
}
```

**Approach B — Unified Signal (simpler)**:
```typescript
// For alternating lunges: use MIN of both knee angles as primary signal
// When left knee bends, left angle drops; right stays extended → min drops
// When right knee bends, right angle drops; left stays extended → min drops
// Result: clean valley per rep regardless of side
private computeUnifiedAngle(landmarks: Landmark[], aspect: number): number {
  const left = this.computeJointAngle(landmarks, 'left_knee', aspect);
  const right = this.computeJointAngle(landmarks, 'right_knee', aspect);
  if (left === null && right === null) return null;
  if (left === null) return right;
  if (right === null) return left;
  return Math.min(left, right); // Valley = rep
}
```

**Config Changes in `reps.py`**:
```python
# Line 239: Change from hardcoded bilateral
side_mode = "alternating" if pattern == "lunge" else "bilateral"

# Line 149-151: Add bilateral joint pairs for alternating exercises
pattern_joints = {
    "lunge": {
        "primary": ["left_knee", "right_knee"],  # or unified approach
        "triplets": [[24,26,28], [23,25,27]]     # both legs
    },
    # ...
}
```

---

### Fix 2: Dynamic Joint Selection & Bilateral Averaging
**Files**: `genericRepCounter.ts`, `reps.py`

```typescript
// In getPrimaryJoint() - replace first-valid with smart selection
private getPrimaryJoint(): string {
  const joints = this.genConfig.primaryJoints;

  if (this.genConfig.sideMode === 'bilateral' && joints.length >= 2) {
    // Return special token indicating bilateral average needed
    return '__BILATERAL_AVG__';
  }
  if (this.genConfig.sideMode === 'alternating') {
    // Will be resolved per-frame in detectActiveSide()
    return '__ALTERNATING__';
  }
  // Unilateral: use configured side
  return joints[0];
}

// In computeJointAngle - handle bilateral average
private computePrimaryAngle(landmarks: Landmark[], aspect: number): number | null {
  const primary = this.getPrimaryJoint();

  if (primary === '__BILATERAL_AVG__') {
    const left = this.computeJointAngle(landmarks, 'left_knee', aspect);
    const right = this.computeJointAngle(landmarks, 'right_knee', aspect);
    if (left === null && right === null) return null;
    if (left === null) return right;
    if (right === null) return left;
    return (left + right) / 2;
  }
  if (primary === '__ALTERNATING__') {
    return this.computeUnifiedAngle(landmarks, aspect);
  }
  return this.computeJointAngle(landmarks, primary, aspect);
}
```

---

### Fix 3: Unified Hysteresis Strategy
**Recommendation**: Use `genericRepCounter.ts` normalized progress approach everywhere.

```typescript
// Standard config (add to CounterConfig)
interface HysteresisConfig {
  enterThreshold: number;    // 0.85 = must reach 85% of ROM
  exitThreshold: number;     // 0.20 = must return to 20% of ROM
  minProgressForPartial: number; // 0.40 = minimum progress to count partial
}

// Apply in state machine
case 'AT_START':
  if (progress > exitThreshold) { state = 'MOVING'; }
  break;
case 'MOVING':
  if (progress >= enterThreshold) { state = 'AT_PEAK'; }
  else if (progress <= exitThreshold) {
    if (maxProgressInRep >= minProgressForPartial) countPartial();
    state = 'AT_START';
  }
  break;
case 'AT_PEAK':
  if (progress <= exitThreshold) { countRep(); state = 'AT_START'; }
  break;
```

**Deprecate**: `repCounter.ts` fixed-angle approach entirely.

---

### Fix 4: Per-Rep Quality Metrics in Production
**File**: `genericRepCounter.ts`

Add to `rep_counted` event:
```typescript
type CounterEvent =
  | { type: 'rep_counted'; count: number; joint: string; durationMs: number
      romFraction: number; quality: 'full' | 'partial'; tempoSec: number }
  // ...
```

In `AT_PEAK` → `AT_START` transition:
```typescript
const romFraction = this.maxProgressInRep; // Already normalized 0-1
const quality = romFraction >= this.config.fullRangeThreshold ? 'full' : 'partial';
const tempoSec = duration / 1000;

this.emitEvent({
  type: 'rep_counted',
  count: this.repCount,
  joint,
  durationMs: duration,
  romFraction,
  quality,
  tempoSec
});
```

---

### Fix 5: Config Generation for All Exercises
**File**: `reps.py` — `generate_angle_configs_from_gifs()`

```python
# Lines 217-243: Replace hardcoded bilateral with pattern-aware side_mode
def determine_side_mode(pattern: str, exercise_name: str) -> str:
    alternating_patterns = {'lunge', 'split_squat', 'step_up', 'single_leg_rdl'}
    unilateral_patterns = {'single_arm_row', 'single_arm_press', 'single_leg_curl'}

    if pattern in alternating_patterns:
        return 'alternating'
    if pattern in unilateral_patterns:
        return 'unilateral_left' if 'left' in exercise_name.lower() else 'unilateral_right'
    return 'bilateral'

# Lines 149-169: Define joint pairs for bilateral/alternating
pattern_joint_pairs = {
    "squat":        {"left": [23,25,27], "right": [24,26,28]},
    "lunge":        {"left": [23,25,27], "right": [24,26,28]},
    "curl":         {"left": [11,13,15], "right": [12,14,16]},
    "horizontal_push": {"left": [11,13,15], "right": [12,14,16]},
    # ...
}

# Line 230-242: Build config with proper joint arrays
config = RepConfig(
    # ...
    primary_joints=pattern_joint_pairs.get(pattern, {}),  # dict, not list
    side_mode=determine_side_mode(pattern, entry.get("name", "")),
    # ...
)
```

---

### Fix 6: Angle Calibration Per User (Not Hardcoded)
**Problem**: All implementations use fixed `start_angle`/`peak_angle` from GIF analysis.

**Solution**: Add calibration phase in `genericRepCounter.ts`:
```typescript
interface CalibrationState {
  samples: number[];
  phase: 'collecting_start' | 'collecting_peak' | 'done';
  startAngle?: number;
  peakAngle?: number;
}

// During first 3 seconds: collect start angle (user stands straight)
// User performs 1 full rep: collect peak angle
// Then: compute actual ROM and set thresholds dynamically
```

---

## 4. Specific Code Changes Summary

| # | File | Change | Priority |
|---|------|--------|----------|
| 1 | `genericRepCounter.ts` | Implement `sideMode: 'alternating'` with per-frame side detection or unified min-angle signal | **CRITICAL** |
| 2 | `genericRepCounter.ts` | Add bilateral averaging for `sideMode: 'bilateral'` | **CRITICAL** |
| 3 | `reps.py` | Generate proper `side_mode` and joint pairs per exercise pattern | **CRITICAL** |
| 4 | `genericRepCounter.ts` | Add per-rep ROM quality (`romFraction`, `quality`) to `rep_counted` event | **HIGH** |
| 5 | `genericRepCounter.ts` | Replace `getPrimaryJoint()` first-valid logic with smart selection | **HIGH** |
| 6 | `reps.py` | Add calibration support: output `calibration_required: true` for exercises without validated angles | **HIGH** |
| 7 | `repCounter.ts` | **Deprecate** — migrate all usage to `GenericRepCounter` | **MEDIUM** |
| 8 | `t4_rep_counter_v2.py` | Add alternating lunge evaluation to benchmark | **MEDIUM** |
| 9 | `genericRepCounter.ts` | Add angle calibration phase (first N frames) | **MEDIUM** |
| 10 | All | Standardize on `visibilityThreshold=0.5`, `fullRangeThreshold=0.85`, `startTolerance=0.2` | **LOW** |

---

## 5. Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GenericRepCounter (TS)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Side Router │→ │ State Mach  │→ │ Quality Assessor    │  │
│  │ (alt/bi/uni)│  │ (hysteresis)│  │ (ROM, tempo, faults)│  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │               │                   │                │
│         ▼               ▼                   ▼                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            Angle Computer (shared)                   │    │
│  │  - Bilateral avg  - Alternating min  - Unilateral   │    │
│  │  - Aspect-corrected  - EMA smoothing  - Visibility  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              GeneratedAngleConfig (from Python)              │
│  { primaryJoints: {left: [...], right: [...]},              │
│    sideMode: 'alternating',                                 │
│    startAngles: {...}, peakAngles: {...},                   │
│    directions: {...}, stabilityConstraints: [...] }         │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Testing Checklist for Fixes

- [ ] Alternating lunges: 10 reps (5L/5R) counted as 10, not 5 or 20
- [ ] Bilateral squat: asymmetric depth detected, average ROM used
- [ ] Unilateral curl: only tracked arm counts, other arm ignored
- [ ] Partial reps: <85% ROM → `quality: 'partial'`, not counted as full
- [ ] Visibility loss: >500ms pauses counting, resumes on restore
- [ ] Calibration: user with 140° straight knee works without config change
- [ ] Tempo: 0.8s–3s reps counted, <400ms or >10s rejected
- [ ] Faults: hip drift during squat → `rep_rejected_fault` emitted

---

*Analysis generated from review of 4 implementation files. Next step: implement Fixes 1-3 in `genericRepCounter.ts` and `reps.py`.*