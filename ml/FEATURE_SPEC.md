# Feature Specification - On-Device Pose ML Pipeline

## Overview
This document specifies the exact feature extraction pipeline that MUST be reproduced identically in:
- Python (training): `ml/src/pq_ml/dataset.py`
- TypeScript (mobile): `shared/pose-features.ts`

Any discrepancy = model mismatch. Run `test_ts_py_parity` to verify.

---

## 1. Pose Estimation (MediaPipe)

### Model
- File: `pose_landmarker_lite.task` (sha256: 59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a)
- API: MediaPipe Tasks Vision, `RunningMode.VIDEO` (live) / `RunningMode.IMAGE` (upload)
- Delegate: CPU (WASM) / GPU (WebGPU if available)

### Parameters
```python
min_pose_detection_confidence = 0.3
min_pose_presence_confidence = 0.3
min_tracking_confidence = 0.3
num_poses = 1
output_segmentation_masks = False
```

### Input Preprocessing (PER FRAME)
1. **Frame source**: Camera (live) or decoded video (upload) → RGB uint8
2. **Transparency handling**: If frame has alpha, composite onto white (255,255,255)
3. **Canvas padding**: Pad to 1.5× original size using corner pixel (0,0) as fill color
   - Original frame placed at offset (W×0.25, H×0.25) on padded canvas
   - `PAD_FACTOR = 1.5`, `OFFSET = (PAD_FACTOR - 1) / 2 = 0.25`
4. **MediaPipe input**: Padded RGB image as `mp.Image(SRGB, data=contiguous_array)`

---

## 2. Keypoint Post-Processing

### Un-Padding (Map MediaPipe output back to original frame coordinates)
MediaPipe returns normalized coordinates [0,1] relative to PADDED image.
```python
# For each landmark (x, y, z, visibility):
x_unpadded = x_padded * PAD_FACTOR - OFFSET   # 1.5 * x - 0.25
y_unpadded = y_padded * PAD_FACTOR - OFFSET
z_unpadded = z_padded * PAD_FACTOR            # z scales with image width
```

### Normalization (MUST match exactly)
```python
def normalize_keypoints(kps_33_4):
    # kps: (33, 4) = x, y, z, visibility in original frame coordinates
    
    # 1. Center on mid-hip
    hip = kps[[23, 24]]              # right hip (23), left hip (24)
    mid_hip = (hip[0] + hip[1]) / 2   # (x, y, z, v)
    
    # 2. Torso length = distance mid-shoulder to mid-hip
    shoulder = kps[[11, 12]]         # left shoulder (11), right shoulder (12)
    mid_shoulder = (shoulder[0] + shoulder[1]) / 2
    torso_vec = mid_hip[:2] - mid_shoulder[:2]  # [dx, dy] in original frame
    torso_len = hypot(torso_vec[0], torso_vec[1]) + 1e-6
    
    # 3. Center and scale
    kps_centered = kps - mid_hip
    kps_normalized = kps_centered / torso_len
    
    return kps_normalized.astype(float32)  # (33, 4)
```

**Output**: 33 × 4 float32 per frame (x, y, z, visibility) — centered at mid-hip, unit = torso length.

---

## 3. Temporal Resampling

### Target
- **15 FPS** fixed
- **Window**: 48 frames = 3.2 seconds
- **Stride**: 24 frames (50% overlap)

### Resampling Algorithm (per joint, per coordinate)
```python
def resample_to_15fps(frames_by_timestamp):
    # frames_by_timestamp: dict {timestamp_sec: (33, 4) normalized keypoints}
    timestamps = sorted(frames_by_timestamp.keys())
    duration = timestamps[-1] - timestamps[0]
    num_frames = round(duration * 15)
    
    kps_array = np.array([frames_by_timestamp[t] for t in timestamps])  # (T, 33, 4)
    t_orig = np.array(timestamps)
    t_new = np.linspace(timestamps[0], timestamps[-1], num_frames)
    
    result = np.empty((num_frames, 33, 4), dtype=float32)
    for joint in range(33):
        for coord in range(4):
            result[:, joint, coord] = np.interp(t_new, t_orig, kps_array[:, joint, coord])
    return result  # (N, 33, 4) where N ≈ 15 * duration
```

### Window Extraction
```python
WINDOW_SIZE = 48
STRIDE = 24

for start in range(0, len(resampled) - WINDOW_SIZE + 1, STRIDE):
    window = resampled[start:start + WINDOW_SIZE]  # (48, 33, 4)
    # → flatten to (48, 132) for model input
```

---

## 4. Model Input Tensor

- **Shape**: `(batch, 48, 132)` — batch, frames, features
- **Features**: 33 joints × 4 coords = 132 per frame
- **Order**: Flattened row-major: `[frame0_joint0_x, frame0_joint0_y, frame0_joint0_z, frame0_joint0_vis, frame0_joint1_x, ...]`
- **Dtype**: float32

---

## 5. Classification (ONNX Runtime)

### Models
| Model | File | Size | Input | Output |
|-------|------|------|-------|--------|
| CNN1D | `cnn1d_int8.onnx` | 170 KB | (1, 48, 132) | (1, 10) logits |
| GRU | `gru_int8.onnx` | 786 KB | (1, 48, 132) | (1, 10) logits |

### Classes (taxonomy_v1, 10 classes)
0. cardio_dynamic
1. core_flexion
2. core_isometric
3. curl
4. hinge
5. horizontal_pull
6. horizontal_push
7. lateral_raise
8. squat
9. triceps_extension

### Post-Processing
```python
logits = model.run(window)[0]  # (1, 10)
probs = softmax(logits)
pred_class = argmax(probs)
confidence = max(probs)

# Open-set rejection
if confidence < 0.3:  # OPEN_SET_REJECTION_THRESHOLD
    return "unknown"

# Pattern verification (live mode only)
if live_mode and pred_class != expected_pattern_class:
    if frames_since_mismatch > 30:  # ~2 seconds at 15 FPS
        emit_warning("pattern_mismatch")
```

---

## 6. Rep Counting (from keypoints)

### Primary Joint Angle
For each exercise (see `generated_angle_configs.json`):
- `primary_joints`: [proximal, middle, distal] landmark indices
- Example squat: `[24, 26, 28]` (left hip, knee, ankle)

```python
def compute_angle(a, b, c):
    # a, b, c: (3,) normalized coordinates
    ba = a - b; bc = c - b
    cosine = dot(ba, bc) / (norm(ba) * norm(bc) + 1e-8)
    return degrees(arccos(clip(cosine, -1, 1)))
```

### Rep Detection
1. Extract angle signal for primary joint across 48-frame window
2. Smooth: moving average, window=5
3. Find peaks/valleys (scipy `find_peaks`, prominence=5°, distance=8 frames)
4. Direction from config:
   - `flexion`: angle decreases → valleys = reps
   - `extension`: angle increases → peaks = reps
4. Filter by expected period: 0.8–3.0 sec (12–45 frames @ 15 FPS)
5. ROM per rep: (max - min) in rep segment / expected_ROM
   - `quality = "full"` if ROM ≥ 0.85 × expected, else `"partial"`

---

## 7. Form Feedback Rules (v1, disabled until validated)

| Exercise | Rule | Metric | Threshold |
|----------|------|--------|-----------|
| squat | Depth | knee angle | ≤ 100° |
| squat | Knee valgus | knee-ankle horizontal offset | > 0.15 × torso |
| squat | Trunk lean | shoulder-hip angle | > 30° from vertical |
| push-up | Hip sag | hip-shoulder-ankle angle | < 160° |
| curl | Elbow drift | elbow x-offset from torso | > 0.1 × torso |
| curl | Shoulder swing | shoulder y-movement | > 0.05 × torso |
| plank | Hip height | hip-shoulder-ankle angle | < 170° |

**Output**: List of `{rule, severity, message}` — severity: "info" | "warning"

---

## 8. Exercise Matching (Upload Mode)

1. Run classifier on video → pattern probabilities
2. Compute joint angle ranges, rep count, tempo from keypoints
3. Rank ExerciseDB candidates:
   - Pattern match (classifier top-3)
   - Equipment match (from catalog)
   - Body part match
   - Angle signature similarity (cosine similarity of mean/std per joint)
4. Return top-3 with scores for user confirmation

---

## 9. Device Tiers (Live Mode)

| Tier | FPS | Max Resolution | Notes |
|------|-----|----------------|-------|
| Low | 5 | 480p | Skip every 2 frames |
| Mid | 10 | 720p | Standard |
| High | 15 | 1080p | Full |

Battery: Pause inference when screen off / app backgrounded.

---

## 10. TypeScript Parity Test

```typescript
// test_ts_py_parity.ts
import { extractFeatures } from './shared/pose-features';

// Load golden fixtures from Python
const pythonFrames = loadFixture('test_fixtures/python_keypoints.json');
const pythonWindows = loadFixture('test_fixtures/python_windows.json');
const pythonAngles = loadFixture('test_fixtures/python_angles.json');

// Run TypeScript
const tsFrames = extractFeatures(pythonFrames.rawFrames);

// Assert
assertClose(tsFrames.normalized, pythonFrames.normalized, 1e-4);
assertClose(tsFrames.windows, pythonWindows, 1e-4);
assertClose(tsFrames.primaryAngle, pythonAngles, 1e-4);
assertEqual(tsFrames.repCount, pythonRepCount);
```

**Golden fixtures location**: `ml/tests/golden/` (generated by Python test script)

---

## 11. Version & Hashes

| Asset | SHA256 |
|-------|--------|
| pose_landmarker_lite.task | 59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a |
| cnn1d_int8.onnx | 9b444181f55ec481f20e397efb1dcf7d1f9d795df9479d92cfc5a2d614323654 |
| gru_int8.onnx | 88b545b9e26abb54d099cf1f1d6bdfe5665d2c66270ff608c27facd83e74c988 |
| generated_angle_configs.json | (compute on build) |
| splits_v1.csv | bfc1ba6305f4d33c1920260cd85470d569a56c2786ab4064f19234adac81c2f5 |

---

*Generated: 2026-11-09. This spec is the single source of truth for mobile implementation.*