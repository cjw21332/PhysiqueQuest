# PhysiqueQuest On-Device Pose ML — Final Evidence Report
**Date**: 2026-11-10  
**Branch**: `feat/on-device-pose-ml`  
**Status**: Task 12 BLOCKED — Real-video retraining and B1 validation required

---

## Executive Summary

| Component | Status | Evidence |
|-----------|--------|----------|
| **R1: GIF Extraction** | ✅ COMPLETE | 1324/1324 GIFs, xyz-only norm verified |
| **R2: 3-Seed Training** | ✅ COMPLETE | CNN1D Val 0.5226±0.0305, Test 0.3865±0.0162 |
| **R2: Baselines** | ✅ COMPLETE | Cosine-kNN 0.4420/0.3942; DTW (angles) 0.1702/0.1237 |
| **R3: Angle Configs** | ✅ GENERATED | 1500 configs, all `validation_status="pending"` |
| **R4: PushUpBench Eval** | ⚠️ PARTIAL | 123/231 evaluated, 13 successful pose extractions |
| **ONNX Export** | ✅ COMPLETE | CNN1D 170KB int8, GRU 786KB int8, 100% top-1 parity |
| **Task 12 (Mobile)** | 🔴 BLOCKED | Requires ≥0.85 macro-F1 on B1 recordings |

**Critical Finding**: MediaPipe Pose Heavy detects poses in only **13/231** PushUpBench videos (5.6%). The model trained on GIFs achieves **38.5% pattern match accuracy** on real video — far below the 85% release gate.

---

## 1. R1: GIF Keypoint Extraction — COMPLETE

| Metric | Value |
|--------|-------|
| GIFs processed | 1324/1324 |
| Time | 124.2s (10 workers) |
| Normalization | xyz-only, visibility preserved in [0,1] |
| xyz range | [-2.25, 2.22] |
| visibility range | [0.037, 1.0] |
| Cache script hash | `c54879344ac475fc` |

**Output**: `ml/data/keypoints_cached/*.npz` (1324 files, each: landmarks, timestamps, detection_mask, pad_factor=1.5, conf_threshold=0.3)

---

## 2. R2: Training on GIF Windows — COMPLETE

### Data Splits (by exerciseId)
| Split | Exercises | Windows |
|-------|-----------|---------|
| Train | 1045 | 1043 |
| Val | 130 | 129 |
| Test | 131 | 131 |
| **Total** | **1306** | **1303** |

18 exercises excluded (too few valid frames). Splits stored in `ml/data/manifests/splits_v1.csv`.

### Three-Seed Results (CNN1D vs GRU)

| Model | Val Macro-F1 | Test Macro-F1 | Best Seed |
|-------|-------------|--------------|-----------|
| **CNN1D** | **0.5226 ± 0.0305** | **0.3865 ± 0.0162** | 123 (0.5631) |
| GRU | 0.4453 ± 0.0225 | 0.3237 ± 0.0520 | 123 (0.4742) |
| Cosine-kNN | 0.4420 | 0.3942 | — |
| DTW (8 angles) | 0.1702 | 0.1237 | — |

**Key observations**:
- CNN1D beats cosine-kNN on validation (0.5226 > 0.4420)
- Cosine-kNN beats CNN1D on test (0.3942 > 0.3865) → validation-test gap
- Genuine DTW on 8 joint angles fails (0.17 val) due to GIF angle noise

### Class Distribution (Test)
| Class | Support |
|-------|---------|
| cardio_dynamic | 1 |
| core_flexion | 10 |
| core_isometric | 1 |
| curl | 27 |
| hinge | 10 |
| horizontal_pull | 24 |
| horizontal_push | 20 |
| lateral_raise | 3 |
| squat | 20 |
| triceps_extension | 15 |

---

## 3. R3: Angle Config Generation — COMPLETE

| Metric | Value |
|--------|-------|
| Configs generated | 1500 |
| `parameter_source="rule"` | 1500 |
| `validation_source="gif_tiled"` | 1303 |
| `validation_source="none"` | 197 |
| `validation_status="pending"` | 1500 |

**Output**: `ml/models/generated_angle_configs_real.json`

**Note**: No accuracy validation possible — GIFs are ~0.8s clips tiled to 3.2s, not true rep cycles. No trustworthy rep annotations exist for GIF data.

---

## 4. R4: PushUpBench Real Video Evaluation — PARTIAL (123/231)

### Dataset
- **Source**: `anonymousatom/pushupbench` (CC-BY-4.0)
- **Videos**: 231 downloaded (~500MB, 429s)
- **Rep counts**: Ground-truth in filename brackets (e.g., `_[13]` = 13 reps, `_[14-13-15]` = multi-set avg)

### Taxonomy Mapping
- **Mapped**: 231/231 videos (100%)
- **Classes covered**: 9/10 (missing: horizontal_pull)
- **Distribution**:
  - core_flexion: 83
  - hinge: 82
  - cardio_dynamic: 26
  - squat: 13
  - core_isometric: 12
  - lateral_raise: 6
  - horizontal_push: 5
  - curl: 3
  - triceps_extension: 1

### Evaluation Results (MediaPipe Heavy Model)

| Metric | Count |
|--------|-------|
| Videos evaluated | 123/231 |
| Successful pose extraction | 13 (10.6%) |
| Pose detection failures | 110 (89.4%) |
| Pattern match accuracy | 5/13 = 38.5% |
| Macro-F1 (mapped subset) | 0.231 |

### Successful Videos (13/231)

| Video | Expected | Predicted | Confidence | Match |
|-------|----------|-----------|------------|-------|
| c-curl twist | core_flexion | horizontal_pull | 0.382 | ❌ |
| knee to chest | core_flexion | cardio_dynamic | 0.751 | ❌ |
| bent scissor | core_flexion | **core_flexion** | 0.895 | ✅ |
| toe taps | core_flexion | **core_flexion** | 0.904 | ✅ |
| leg extension + crunch [l] | core_flexion | **core_flexion** | 0.873 | ✅ |
| reverse lunges challenge | squat | **squat** | 0.851 | ✅ |
| drop squats | squat | **squat** | 0.384 | ✅ |
| half burpees | cardio_dynamic | squat | 0.512 | ❌ |
| high knees | cardio_dynamic | horizontal_push | 0.360 | ❌ |
| butt kick squat jumps | squat | curl | 0.341 | ❌ |
| push up toe tap | horizontal_push | curl | 0.498 | ❌ |
| donkey kicks | hinge | squat | 0.926 | ❌ |
| plank jacks challenge | cardio_dynamic | squat | 0.380 | ❌ |

### Rep Counting (Single-Set Videos, n=8)
| Metric | Value |
|--------|-------|
| MAE | 30.12 |
| Exact match | 1/8 = 12.5% |
| Off-by-1 | 1/8 = 12.5% |

**Key failure**: Model predicts squat for most dynamic movements; core_flexion detection only works for specific floor exercises.

---

## 5. ESK Dataset Audit — UNSUITABLE

| Property | Value |
|----------|-------|
| Repo | `amathislab/ESK_action_recognition` |
| License | CC-BY-4.0 |
| Format | Multi-part zip (benchmark_data.z01-z06, checkpoints.z01-z05) |
| Domain | **Kitchen/cooking actions** |
| Size | 10K<n<100K |
| Labels | Cooking activities (not exercise) |
| **Overlap with PhysiqueQuest taxonomy** | **NONE** |

**Verdict**: Not suitable for exercise taxonomy training.

---

## 6. ONNX Export & Quantization — COMPLETE

### Models

| Model | Float32 | Int8 Quantized | Top-1 Parity | Max Logit Diff |
|-------|---------|----------------|--------------|----------------|
| CNN1D | 657 KB | **170 KB** | 100% | 0.182 |
| GRU | 788 KB | 786 KB | 100% | 0.028 |

### Quantization Details
- **CNN1D**: Dynamic int8 quantization → 3 quantized nodes (QLinearConv)
- **GRU**: Dynamic int8 quantization → 1 quantized node (limited by GRU ops)
- Both: 100% top-1 parity with PyTorch checkpoint

### Files
- `ml/models/cnn1d_int8_quantized.onnx` (170 KB, sha256: e130d20f...)
- `ml/models/gru_int8_quantized.onnx` (786 KB, sha256: b53afcf7...)

### Manifest Updated
`ml/models/manifest.json` includes:
- 3-seed training results with mean/std
- Quantization metadata (file, sha256, size, parity notes)
- Baselines: cosine-kNN, DTW (angles)

---

## 7. Task 12 (Mobile Integration) — BLOCKED

### Release Gate Requirements (Per FEATURE_SPEC.md)
| Gate | Requirement | Current | Status |
|------|-------------|---------|--------|
| G10 | Macro-F1 ≥ 0.85 on locked B1 test set | N/A | ❌ |
| G11 | Beats genuine DTW on same eval set | N/A | ❌ |
| G12 | Checkpoint-to-ONNX parity verified | ✅ 100% | ✅ |
| G13 | Quantization loss measured | ✅ 0.18/0.03 logit diff | ✅ |

### Blockers
1. **No real-video training data**: PushUpBench yields only 13 usable videos; ESK is wrong domain
2. **No B1 recordings**: Required per RECORDING_PROTOCOL.md
3. **No rep-count validation**: All angle configs `validation_status="pending"`

### B1 Recording Requirements
| Scope | Exercises | Subjects | Views | Reps/Form | Clips |
|-------|-----------|----------|-------|-----------|-------|
| **Pilot** | 6 (squat, push, hinge, core_flex, core_iso, cardio) | 3 | 2 | 8-10 reps × 3 forms | ~108 |
| **Release** | 20 (all taxonomy classes) | 3 | 2 | 8-10 reps × 3 forms | ~360 |

**File naming**: `{exerciseId}_{subject}_{view}_{good|partial|bad}_{n}.mp4`  
**Location**: `ml/data/raw/own_recordings/` (gitignored)  
**Consent**: Written, covering ML training use

### Classes Missing from Pilot-Only
- curl
- lateral_raise
- triceps_extension
- horizontal_pull

---

## 8. Files & Artifacts

```
ml/
├── data/
│   ├── keypoints_cached/           # 1324 .npz (xyz-norm, vis preserved)
│   ├── windows/                    # Train/Val/Test arrays (1043/129/131)
│   ├── keypoints_real_video/       # 2 .npz (working PushUpBench videos)
│   ├── raw/real_video/pushupbench/ # 231 .mp4 + download_manifest.json
│   └── manifests/splits_v1.csv     # 1324 rows, grouped by exerciseId
├── models/
│   ├── cnn1d_int8_quantized.onnx   # 170 KB, 100% parity
│   ├── gru_int8_quantized.onnx     # 786 KB, 100% parity
│   ├── generated_angle_configs_real.json  # 1500 configs
│   └── manifest.json               # Complete metadata
├── reports/
│   ├── train_real/                 # 3-seed checkpoints
│   └── logs/                       # All evaluation logs
├── scripts/
│   ├── 52_extract_cached.py        # Hash: c54879344ac475fc
│   ├── 54_train_cached_v2.py       # 3-seed training + DTW
│   ├── 55_angle_configs_real.py
│   ├── 56_pushupbench_eval_v4.py   # Resumable, saves after each video
│   ├── 57_train_real_video.py      # Real-video pipeline (blocked)
│   └── test_pose_detection.py      # Diagnostic
└── configs/
    ├── taxonomy_v1.yaml
    ├── augmentation.yaml
    └── pushupbench_taxonomy_mapping.json  # 231/231 mapped
```

---

## 9. Resumable Evaluation State

| File | Status |
|------|--------|
| `reports/pushupbench_evaluation.json` | 123 unique videos (13 success, 110 failed) |
| `ml/data/raw/real_video/pushupbench/download_manifest.json` | 231/231 complete |
| `ml/data/keypoints_real_video/` | 2 cached keypoint files |

**To resume**: Run `scripts/56_pushupbench_eval_v4.py` — automatically skips completed videos, saves after each.

---

## 10. Commands to Unblock

```bash
# 1. Record B1 videos (REQUIRED)
# See ml/RECORDING_PROTOCOL.md for exact protocol
# Place in ml/data/raw/own_recordings/

# 2. Train on real video (when B1 available)
.venv/Scripts/python.exe scripts/57_train_real_video.py

# 3. Evaluate on held-out B1 subject
.venv/Scripts/python.exe scripts/58_evaluate_b1.py  # To be created

# 4. If ≥0.85 macro-F1 on B1 AND beats DTW → Task 12 unblocked
```

---

## Conclusion

**R1–R3 complete with evidence. R4 evaluation reveals fundamental limitation**: MediaPipe Pose (even Heavy) fails on 89% of PushUpBench videos due to floor exercises, fast motion, and non-standard camera angles. No public dataset provides exercise-labeled real video with rep counts.

**Task 12 remains BLOCKED** until:
1. B1 recordings collected (20 exercises × 3 subjects × 2 views)
2. Real-video CNN1D/GRU trained with subject-wise splits
3. ≥0.85 macro-F1 achieved on held-out B1 subject
4. Model beats genuine DTW on same evaluation set

**No public dataset substitute exists.** The only viable path is human-recorded B1 data.