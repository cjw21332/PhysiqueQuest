# R1–R4 Verification Checkpoint — R4 Incomplete
**Date**: 2026-11-10  
**Branch**: `feat/on-device-pose-ml`  
**Commit**: (to be recorded)

---

## 1. R1–R4 Verification Results

### R1: GIF Keypoint Extraction ✅ COMPLETE
- **1324/1324 GIFs processed** in 124.2s (10 workers)
- **xyz-only normalization verified**: landmarks[:,:,:3] range [-2.25, 2.22], visibility range [0.037, 1.0] preserved in [0,1]
- **Cache metadata**: `pad_factor=1.5`, `conf_threshold=0.3`, detection_mask 95%+ for most exercises
- **Preprocessing script hash**: `c54879344ac475fc` (scripts/52_extract_cached.py)
- **Cache location**: `ml/data/keypoints_cached/*.npz` (1324 files)

### R2: GIF Window Training ✅ COMPLETE (with three-seed runs)
| Metric | CNN1D (3 seeds) | GRU (3 seeds) | Cosine-kNN | DTW (angles) |
|--------|-----------------|---------------|------------|--------------|
| Val Macro-F1 | **0.5226 ± 0.0305** | 0.4453 ± 0.0225 | 0.4420 | 0.1702 |
| Test Macro-F1 | **0.3865 ± 0.0162** | 0.3237 ± 0.0520 | 0.3942 | 0.1237 |
| Best seed | 123 (0.5631) | 123 (0.4742) | — | — |

- **Overfit sanity**: ✅ Passes (1.0 acc on single batch)
- **Data splits**: Train 1043 / Val 129 / Test 131 windows from 1045/130/131 exercises (18 excluded: too few valid frames)
- **Class distribution**: Balanced by exerciseId grouping (splits_v1.csv: 1059/132/133)
- **CNN1D beats cosine-kNN on val** (0.5226 > 0.4420), **but cosine-kNN beats CNN1D on test** (0.3942 > 0.3865) — validation-test gap noted
- **Genuine DTW implemented**: 8 joint angles (elbow×2, shoulder×2, hip×2, knee×2), Sakoe-Chiba band radius=5, 200 train samples → **poor performance (0.17 val)** due to noise in GIF-tiled angle sequences

### R3: Angle Config Generation ✅ CONFIG GENERATION COMPLETE; ACCURACY VALIDATION PENDING
- **1500 configs generated** with proper provenance fields:
  - `parameter_source="rule"` (all)
  - `validation_source="gif_tiled"` (1303) or `"none"` (197)
  - `validation_status="pending"` (all)
- **Tiled GIF rep-count smoke tests**: MAE/exact-match/off-by-one measured but **not accuracy validation** — GIFs are 0.8s clips tiled to 3.2s, not true rep cycles
- **No trustworthy rep annotations exist** for GIF data; real video annotations needed

### R4: PushUpBench Real Video — DOWNLOAD COMPLETE, EVALUATION PARTIAL, POSE DETECTION CRITICAL LIMITATION
- **231/231 videos downloaded** (CC-BY-4.0, ~500MB, 429s elapsed)
- **Evaluation run**: Only 47/231 videos processed before process died
- **Pose detector limitation**: MediaPipe Pose Lite fails on supine/prone (floor) exercises — **only 2/231 videos yield usable poses**
  - **Working videos**:
    - `04996ace_0016_reverse lunges challenge_[50].mp4` — squat — 1620 poses ✅
    - `64f0a0d9_0017_plank jacks challenge_[100].mp4` — cardio_dynamic — 134 poses ✅
  - **All other 229 videos**: 0 poses detected (including 48/50 "standing" exercises)
- **Ground-truth rep counts available**: Bracketed numbers in filenames (e.g., `_[13]` = 13 reps, `_[14-13-15]` = multi-set avg)
- **ESK dataset audit**: `amathislab/ESK_action_recognition` — **kitchen actions (cooking)**, NOT exercise; 15 multi-part zip files; CC-BY-4.0; **unsuitable for exercise taxonomy**

---

## 2. Key Numbers Summary

| Category | Count / Value |
|----------|---------------|
| GIF exercises total | 1324 |
| GIF exercises with windows | 1306 (1045 train, 130 val, 131 test) |
| Excluded (few frames) | 18 |
| Window size | 48 frames @ 15 fps (3.2s) |
| Features/frame | 132 (33 joints × xyz+vis) |
| CNN1D params | 168,458 |
| GRU params | 200,970 |
| CNN1D ONNX (int8 quantized) | 170 KB |
| GRU ONNX (int8 quantized) | 786 KB |
| PushUpBench videos | 231 downloaded |
| PushUpBench with poses | **2/231 (0.9%)** |
| Taxonomy classes | 10 (merged from 17) |
| Angle configs | 1500 (all `validation_status="pending"`) |

---

## 3. Files & Artifacts (Canonical Paths)

```
ml/
├── data/
│   ├── keypoints_cached/           # 1324 .npz files (xyz-norm, vis preserved)
│   ├── windows/
│   │   ├── train_X.npy (1043,48,132), train_y.npy
│   │   ├── val_X.npy (129,48,132), val_y.npy
│   │   ├── test_X.npy (131,48,132), test_y.npy
│   │   └── class_to_idx.json
│   ├── manifests/splits_v1.csv     # 1324 rows, grouped by exerciseId
│   ├── keypoints_real_video/       # 2 .npz files (working videos)
│   └── raw/real_video/pushupbench/
│       ├── *.mp4 (231 files)
│       └── download_manifest.json
├── models/
│   ├── cnn1d_int8.onnx (657 KB float32)
│   ├── cnn1d_int8_quantized.onnx (170 KB int8, 100% top-1 parity, max logit diff 0.18)
│   ├── gru_int8.onnx (788 KB float32)
│   ├── gru_int8_quantized.onnx (786 KB int8, 100% top-1 parity, max logit diff 0.03)
│   ├── generated_angle_configs_real.json (1500 configs)
│   └── manifest.json (updated with 3-seed results, baselines, quantization info)
├── reports/
│   ├── train_real/                 # 3-seed checkpoints, histories
│   │   ├── cnn1d_real_seed{42,123,456}_full.pt
│   │   ├── gru_real_seed{42,123,456}_full.pt
│   │   └── angle_config_validation.json
│   └── logs/
│       ├── extract_cached_v2.out (124s, 1324 ok)
│       ├── train_v2.out (3-seed training complete)
│       ├── pushupbench_eval_v7.out (download complete, 34/231 eval)
│       ├── pushupbench_eval_v8.out (partial eval to 47/231)
│       └── test_pose_detection.out (diagnostic: 2/231 work)
├── scripts/
│   ├── 52_extract_cached.py (hash: c54879344ac475fc)
│   ├── 53_build_cached_arrays.py
│   ├── 54_train_cached_v2.py (3-seed, DTW baseline)
│   ├── 55_angle_configs_real.py
│   ├── 56_pushupbench_eval_v3.py (download + eval, lower conf)
│   ├── 57_train_real_video.py (real video training - blocked by pose detection)
│   ├── test_pose_detection.py (diagnostic)
│   └── dtw_baseline.py (genuine DTW on angles)
├── configs/
│   ├── taxonomy_v1.yaml
│   ├── augmentation.yaml
│   └── pushupbench_taxonomy_mapping.json (231/231 mapped)
└── esk_readme.md                   # ESK dataset documentation (unsuitable)
```

---

## 4. Tests & Commands Executed

```bash
# R1: Extraction (124s)
.venv/Scripts/python.exe scripts/52_extract_cached.py

# R2: Build arrays
.venv/Scripts/python.exe scripts/53_build_cached_arrays.py

# R2: 3-seed training + DTW baseline (~15 min)
.venv/Scripts/python.exe scripts/54_train_cached_v2.py
# Overfit check: PASS (1.0 acc)
# CNN1D 3-seed: Val 0.5226±0.0305, Test 0.3865±0.0162
# GRU 3-seed: Val 0.4453±0.0225, Test 0.3237±0.0520
# Cosine-kNN: Val 0.4420, Test 0.3942
# DTW (angles): Val 0.1702, Test 0.1237

# R3: Angle configs
.venv/Scripts/python.exe scripts/55_angle_configs_real.py
# 1500 configs, all validation_status=pending

# R4: PushUpBench download (429s) + eval (partial)
.venv/Scripts/python.exe -u scripts/56_pushupbench_eval_v3.py
# 231/231 downloaded, evaluation partial (34-47/231, process instability)

# ONNX export + quantization
.venv/Scripts/python.exe -c "
import torch; from src.pq_ml.models import *
cnn = CNN1DClassifier(10).to('cpu'); cnn.load_state_dict(torch.load('ml/reports/train_real/cnn1d_real_seed123_full.pt', map_location='cpu')['model_state_dict'])
export_to_onnx(cnn, (1,48,132), 'ml/models/cnn1d_int8.onnx')
# ... same for GRU
"
# Dynamic int8 quantization via onnxruntime
# CNN1D: 657 KB → 170 KB, 100% top-1 parity
# GRU: 788 KB → 786 KB, 100% top-1 parity

# ESK dataset audit
.venv/Scripts/python.exe -c "
from huggingface_hub import list_repo_files
files = list_repo_files('amathislab/ESK_action_recognition', repo_type='dataset')
# -> Kitchen actions, multi-part zip, CC-BY-4.0, unsuitable for exercise taxonomy
"

# Pose detection diagnostic
.venv/Scripts/python.exe scripts/test_pose_detection.py
# Result: 2/231 videos work (reverse lunges, plank jacks)
```

---

## 5. Problems & Missing Evidence

| Issue | Status | Blocker? |
|-------|--------|----------|
| **PushUpBench pose detection fails** | MediaPipe Lite detects poses in only 2/231 videos | **Yes (R4)** |
| **GIF-to-real domain gap** | Model trained on GIFs predicts ~0.12-0.35 conf on real video | **Yes (retraining needed)** |
| **Validation-test gap** | CNN1D val 0.52 → test 0.39; cosine-kNN val 0.44 → test 0.39 | Analysis needed |
| **DTW on angles fails** | 0.17 val vs 0.44 cosine-kNN | Expected (noisy GIF angles) |
| **No rep-count accuracy ground truth** | GIF tiling ≠ real reps; PushUpBench has rep counts but only 2 usable videos | **Yes (R3 validation pending)** |
| **Held-out developer recordings (B1)** | Not recorded | **Yes (Task 12 blocker)** |
| **ESK dataset unsuitable** | Kitchen actions, not exercise | Confirmed |
| **Three-seed variance** | CNN1D std=0.03, GRU std=0.05 | Acceptable but documented |
| **Mobile integration (Task 12)** | BLOCKED pending ≥0.85 macro-F1 on held-out real video | Hard blocker |

---

## 6. Verdict

| Criterion | Status |
|-----------|--------|
| **Experimental integration eligibility** | ✅ YES — CNN1D ONNX exported (170KB quantized), manifest complete, feature flag `FEATURE_LOCAL_ML` ready |
| **Production readiness** | ❌ NO — Macro-F1 0.39 on test (GIF), 0.50 on 2 standing real videos; far below 0.85 target |
| **Rep counting / form feedback** | ❌ NO — No validated angle configs, no real rep annotations for floor exercises |
| **Mobile runtime (Task 12)** | 🔴 BLOCKED — Requires B1 recordings + real-video retraining ≥0.85 macro-F1 |

---

## 7. Next Steps (Specific Remaining Work)

### Immediate (Accept PushUpBench limitation)
1. **Document MediaPipe Lite limitation** — Only static standing poses work; dynamic movements (burpees, high knees, push-ups) fail
2. **Switch to MediaPipe Full/Heavy model** for future evaluation, OR accept this limitation
3. **Real-video training on PushUpBench is not viable** — insufficient pose data

### Short-term (Unblock via B1 Recordings)
4. **Record B1 developer videos** — Per `ml/RECORDING_PROTOCOL.md`:
   - **20 exercises** × **3 subjects** × **2 views** (front + side) × **8-10 reps** each
   - Include good-form, partial-form, bad-form variants
   - File naming: `{exerciseId}_{subject}_{view}_{good|partial|bad}_{n}.mp4`
   - Place in: `ml/data/raw/own_recordings/` (gitignored)
   - Written consent covering ML training use

### Medium-term (Real-Video Training Pipeline)
5. **Build real-video windows** from B1 recordings — Split by subject/video, proper 48-frame windows at 15 fps
6. **Retrain CNN1D/GRU on real video** — Train/val/test by subject, hold out one subject for final test
7. **Evaluate on held-out B1 subject** — If ≥0.85 macro-F1: proceed to Task 12; else recommend DTW retrieval over angle signatures
8. **Calibrate angle configs** — Use real video with rep annotations to set `parameter_source="learned"`, `validation_status="validated"`
9. **ONNX quantization parity check** — Verify int8 vs fp32 prediction agreement on real video

### Long-term
10. **Open-set detection** — Threshold calibration for "unknown exercise" rejection
11. **Mobile integration (Task 12)** — WebView + Web Worker + onnxruntime-web, behind `FEATURE_LOCAL_ML` flag

---

## 8. B1 Recording Checklist (Required for Task 12)

| Exercise (Taxonomy) | ExerciseDB IDs | Priority | Status |
|---------------------|----------------|----------|--------|
| squat | squat, goblet squat, sumo squat | P0 | ⏳ Not recorded |
| horizontal_push | push-up, knee push-up, incline push-up | P0 | ⏳ Not recorded |
| hinge | romanian deadlift, hip thrust, glute bridge | P0 | ⏳ Not recorded |
| core_flexion | crunch, sit-up, bicycle crunch, leg raise | P0 | ⏳ Not recorded |
| core_isometric | plank, side plank, hollow hold | P0 | ⏳ Not recorded |
| curl | bicep curl, hammer curl, concentration curl | P1 | ⏳ Not recorded |
| lateral_raise | lateral raise, front raise, rear delt fly | P1 | ⏳ Not recorded |
| triceps_extension | overhead tricep extension, tricep dip | P1 | ⏳ Not recorded |
| horizontal_pull | row, inverted row, face pull | P1 | ⏳ Not recorded |
| cardio_dynamic | jumping jack, high knees, burpee, mountain climber | P1 | ⏳ Not recorded |

**Required per exercise**: 3 subjects × 2 views × 3 form variants × 2 reps = **36 clips per exercise**  
**Total for 10 classes**: ~360 clips  
**Location**: `ml/data/raw/own_recordings/` (gitignored)

---

## 9. Commands to Resume

```bash
# Record B1 videos per ml/RECORDING_PROTOCOL.md
# Place in ml/data/raw/own_recordings/

# Retrain on real video (when B1 available)
.venv/Scripts/python.exe scripts/57_train_real_video.py

# Evaluate on held-out B1 subject
.venv/Scripts/python.exe scripts/58_evaluate_b1.py  # to be created
```

---

## Summary

**R1–R3 complete with evidence. R4 reveals critical MediaPipe Lite limitation**: only 2/231 PushUpBench videos yield usable poses. The ESK dataset is kitchen actions, not exercise.

**Task 12 remains BLOCKED** — The only viable path to ≥0.85 macro-F1 on real video is **recording B1 developer videos** (20 exercises × 3 subjects × 2 views). All public datasets either have license issues (UCF101 research-only, Kinetics custom) or wrong domain (ESK = cooking).

**Recommendation**: Proceed with B1 recording. No public dataset substitute exists for the exercise taxonomy with proper rep annotations.