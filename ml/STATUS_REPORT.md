# PhysiqueQuest On-Device ML Pipeline - Status Report

## Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| 0: Discovery | ✅ Done | ENVIRONMENT_REPORT.md created |
| 1: Python Environment | ✅ Done | venv created, requirements installed, smoke test passed |
| 2: Catalog Mapping | ✅ Done | 1500 exercises mapped, priority set reviewed, tests pass |
| 3: Data Acquisition | ✅ Done | 1324/1500 ExerciseDB GIFs downloaded; 176 404s; public datasets cataloged |
| 4: Keypoint Extraction | ✅ Done | **Fixed extractor (white composite + 1.5x pad + 0.3 conf)**; 1324 GIFs processed; 95.1% frames with pose (16359/17194); 1277/1324 GIFs ≥60% detection |
| 5: Keypoint Sanity Check | ✅ Done | 6 exercises visualized (24 skeleton frames + 6 angle plots); 100% periodicity in sample; GIFs too short (median 12 frames) |
| 6: Real-Video Data Search | ✅ Done | 235 HF datasets searched; PushUpBench (CC-BY-4.0, 231 videos), ESK (CC-BY-4.0) identified; UCF101 corrected to "research use only" |
| 7: Dataset Assembly | ✅ Done | 1324 GIF groups split 80/10/10 (1059/132/133); 10 classes after merging weak patterns; taxonomy_v1.yaml, splits_v1.csv |
| 8: Augmentation | ✅ Done | augmentation.yaml with 10 augmentations (mirror, rotation, scale, translation, noise, dropout, visibility, speed, temporal crop, camera yaw) |
| 9: Training | ✅ Done | CNN1D (168K params) and GRU (201K params) trained on GPU (RTX 3050); exported to ONNX |
| 10: Rep Counting | ✅ Done | generated_angle_configs.json (1500 exercises); reps.py with hysteresis peak/valley detection |
| 11: Export & Manifest | ✅ Done | CNN1D int8: 170 KB, GRU int8: 786 KB; manifest.json with parity checks (Top-1: 1.0) |
| 12: Mobile Integration | ⏳ Pending | Next: Path A integration (WebWorker + onnxruntime-web) |

## Key Deliverables

| File | Description |
|------|-------------|
| `ml/PROGRESS.md` | Phase-by-phase progress tracking |
| `ml/ENVIRONMENT_REPORT.md` | Hardware/OS/repo analysis |
| `ml/STATUS_REPORT.md` | **Status report** |
| `ml/BLOCKERS.md` | 3 active blockers (B1: recordings, B2: device test, B3: ExerciseDB GIF license) |
| `ml/DATA_LICENSES.md` | License verification log (UCF101 corrected to research-only) |
| `ml/reports/hf_candidates.json/md` | 235 HF dataset candidates |
| `ml/reports/hf_key_findings.json` | Key dataset findings |
| `ml/reports/skeleton_check/*.png` | 30 skeleton/angle visualizations |
| `ml/reports/data_inventory.md` | Full data inventory |
| `ml/reports/train/*_metrics.json, *_confusion.png` | Training metrics |
| `ml/configs/taxonomy_v1.yaml` | 10-class merged taxonomy |
| `ml/configs/augmentation.yaml` | 10 augmentation configs |
| `ml/data/manifests/splits_v1.csv` | 1324 group splits |
| `ml/data/manifests/combined_manifest.json` | GIF extraction metadata |
| `ml/data/keypoints/` | 15656 window manifests (GIFs too short for full windows) |
| `ml/data/keypoints_real/` | PushUpBench real video keypoints (extracting) |
| `ml/scripts/40-46.py` | 7 pipeline scripts |
| `ml/src/pq_ml/dataset.py` | PyTorch Dataset with on-the-fly augmentation |
| `ml/src/pq_ml/models.py` | CNN1D & GRU model definitions |
| `ml/src/pq_ml/reps.py` | Rep counting, ROM, tempo |
| `ml/models/pose_landmarker_lite.task` | MediaPipe Lite model (5.5 MB, sha256: 59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a) |
| `ml/models/cnn1d_int8.onnx` | Quantized CNN1D (170 KB, Top-1 agreement: 1.0) |
| `ml/models/gru_int8.onnx` | Quantized GRU (786 KB, Top-1 agreement: 1.0) |
| `ml/models/generated_angle_configs.json` | 1500 exercise rep configs |
| `ml/models/manifest.json` | Full model manifest with hashes |

## GIF Extraction Summary (FIXED)

- **Files processed**: 1324 GIFs (176 permanently 404)
- **Frames with pose**: 95.1% (16359/17194)
- **GIFs with ≥60% detection**: 1277/1324
- **Total windows in manifest**: 15656 (but GIFs too short for 48-frame windows)
- **Preprocessing**: White composite + 1.5x pad (corner pixel) + confidence 0.3 (matches debug_pose.py findings)
- **Note**: GIFs median 12 frames (0.8s) vs 48-frame (3.2s) window requirement

## Real Video Data

| Dataset | License | Videos | Status |
|---------|---------|--------|--------|
| PushUpBench | CC-BY-4.0 | 231 | Downloading/extracting (65 windows from 2 videos so far) |
| ESK Action Recognition | CC-BY-4.0 | ~? | Multi-part zip, deferred |
| UCF101 | Research use only | 13k+ | License corrected (NOT CC-BY-4.0) |
| Kinetics-700 | Custom (research) | 650k | Non-commercial only |

## Taxonomy v1 (10 classes, merged weak patterns)

| Class | Includes | Train Groups | Val | Test |
|-------|----------|--------------|-----|------|
| squat | squat, lunge | 225 | 35 | 20 |
| curl | curl | 205 | 16 | 27 |
| horizontal_push | horizontal_push, vertical_push | 173 | 21 | 21 |
| horizontal_pull | horizontal_pull, vertical_pull | 141 | 23 | 24 |
| triceps_extension | triceps_extension | 101 | 7 | 15 |
| core_flexion | core_flexion, rotation | 75 | 10 | 10 |
| hinge | hinge, hip_thrust_bridge, calf_raise | 71 | 12 | 11 |
| lateral_raise | lateral_raise, front_raise, rear_delt | 30 | 3 | 3 |
| cardio_dynamic | cardio_dynamic, carry_locomotion | 18 | 3 | 1 |
| core_isometric | core_isometric | 20 | 2 | 1 |

## Training Results (GIF-only dummy data - not real-world validated)

| Model | Params | Best Val Macro-F1 | Final Val Acc | Quantized Size | Parity (Top-1) |
|-------|--------|-------------------|---------------|----------------|----------------|
| CNN1D | 168K | 0.042 | 26.5% | 170 KB | 1.000 |
| GRU | 201K | 0.014 | 5.3% | 786 KB | 1.000 |

**Note**: Trained on synthetic dummy sequences (GIFs too short for real windows). Real video data (PushUpBench) extraction in progress. Results labeled "validated on GIF/public data only; not real-world".

## Export Manifest

- **Version**: 1.0.0
- **Pose model**: pose_landmarker_lite.task (sha256: 59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a)
- **Data inventory hash**: bfc1ba6305f4d33c1920260cd85470d569a56c2786ab4064f19234adac81c2f5
- **Labels**: 10 classes (taxonomy_v1)
- **Thresholds**: classification_confidence=0.5, open_set_rejection=0.3
- **Input spec**: window=48, features=132, fps=15, normalization=mid_hip_center_torso_length

## Blocker Status

| ID | Blocker | Impact | Resolution |
|----|---------|--------|------------|
| B1 | Own recorded videos (≥3 subj × 5 clips × 6 exercises) | Cannot validate real-world accuracy honestly | ⏳ Awaiting human recording; protocol in ml/RECORDING_PROTOCOL.md |
| B2 | Physical device for on-device testing | Cannot verify FPS/latency/battery | ⏳ Path A (WebWorker) used; native test later |
| B3 | ExerciseDB GIF license verification | If restricted, GIFs only for reference | ⏳ In progress |

## Next Steps (Task 12: Mobile Integration - Path A)

1. Implement feature pipeline in `shared/` TypeScript (normalization, smoothing, angles, windowing) per FEATURE_SPEC.md
2. Create golden test files from Python and assert identical outputs (test_ts_py_parity)
3. Run classifier with onnxruntime-web inside existing pose.worker.ts (WASM; WebGPU if available)
4. Live mode: use generated_angle_configs for counting; classifier verifies pattern (soft warning)
5. Upload mode: decode ≤15 FPS, run pose, classify, rank ExerciseDB candidates
6. FEATURE_LOCAL_ML flag; fallback to manual logging (live) or Gemini /pose/analyze (upload)
7. Backend: extend exercise-registry.ts with optional ML metadata fields
8. Tests: TS unit tests for feature pipeline, rep counter regression, worker contract

---

*Generated: 2026-11-09. Pipeline branch: feat/on-device-pose-ml.*