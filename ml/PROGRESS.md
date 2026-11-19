# ML Pipeline Progress Tracker

## Phase Checklist

| Phase | Status | Notes |
|-------|--------|-------|
| 0: Discovery | ✅ Done | ENVIRONMENT_REPORT.md created |
| 1: Python Environment | ✅ Done | venv created, requirements installed, smoke test passed |
| 2: Catalog Mapping | ✅ Done | 1500 exercises mapped, priority set reviewed, tests pass |
| 3: Data Acquisition | ✅ Done | 1324/1500 ExerciseDB GIFs downloaded (resumable); public datasets cataloged |
| 4: Keypoint Extraction | ✅ Done | 231/231 PushUpBench clips extracted to FEATURE_SPEC (scripts/71_extract_videos.py); conformance tests in tests/test_preprocessing_spec.py |
| 5: Augmentation | ⏳ Pending | Awaiting data/model |
| 6: Training | ⚠️ Baseline | Pattern classifier trained on PushUpBench (CC-BY-4.0) only; test macro-F1 0.36 (gate G4 0.85 not met) |
| 7: Rep Counting & Form | ⏳ Pending | Awaiting real recordings (B1) |
| 8: Export | ⚠️ Baseline | ONNX + int8 written to ml/models/pattern_v1/; int8 drops macro-F1 0.11 (gate G8 <=1.5 pts fail) |
| 9: Mobile Integration | ⏳ Pending | Awaiting data/model |

## Gates Status

| Gate | Metric | Target | Actual | Status |
|------|--------|--------|--------|--------|
| G1 | Environment smoke test | pass | pass | ✅ |
| G2 | Catalog coverage; priority reviewed | 100% mapped; 100% priority reviewed | 1500/1500 mapped; 100% priority reviewed | ✅ |
| G3 | License log complete; no leakage | pass | pass | ✅ |
| G4 | Pattern classifier macro-F1 (real recordings) | ≥ 0.85 | 0.36 (PushUpBench within-dataset, 7 classes) | ❌ Gate not met |
| G5 | Open-set false-accept rate | ≤ 10% | — (public/GIF only) | ⏳ "validated on public/GIF only" |
| G6 | Rep counting exact-match / OBO | ≥ 70% / ≥ 90% | — (public/GIF only) | ⏳ "validated on public/GIF only" |
| G7 | Form rules precision | ≥ 0.8 | — (public/GIF only) | ⏳ "validated on public/GIF only" |
| G8 | Quantized accuracy drop; model size | ≤ 1.5 pts; < 1 MB | -10.9 pts (int8 macro-F1 0.25 vs float 0.36); 173 KB | ❌ Gate not met |
| G9 | Python vs TS parity | identical | ONNX export parity max |torch-onnx| = 1.91e-06 (export only) | ⚠️ Partial |
| G10 | On-device perf (FPS, latency) | ≥ 10 FPS; < 10ms | — (public/GIF only) | ⏳ "validated on public/GIF only" |
| G11 | End-to-end integration | pass | — (no real device test) | ⚠️ Not marked `verified`; B1 blocker |
| G12 | Regression tests | pass | pass | ✅ |

## Commands Run

- `git checkout -b feat/on-device-pose-ml`
- Created ml/ directory structure
- Analyzed key codebase files (pose.worker.ts, exercisedb.service.ts, pose.service.ts, etc.)
- Created ENVIRONMENT_REPORT.md
- Created venv and installed requirements (torch, mediapipe, onnx, tensorflow, etc.)
- Ran environment smoke test - all checks passed
- Executed `python scripts/10_fetch_exercisedb.py` - fetched 1500 ExerciseDB exercises
- Executed `python scripts/20_create_ml_mapping.py` - created exercise_ml_map.json with deterministic rule-based pattern assignment
- Executed `python scripts/check_priority.py` - verified priority exercise mappings
- Executed `python -m pytest tests/test_catalog_mapping.py` - all 7 tests passed
- Executed `python scripts/30_download_gifs.py` - downloaded 1324/1500 ExerciseDB GIFs (resumable)
- Executed `python scripts/40_extract_keypoints.py` - keypoint extraction pipeline designed; MediaPipe 1.2.2 constraints documented in ml/reports/keypoint_extraction.log
- Executed `python -m pytest tests/test_catalog_mapping.py` - all 7 tests passed

## Next Actions

1. Phase 5: Augmentation pipeline implementation (requires alternative keypoint extraction)
2. Phase 6: Model training and evaluation with source-video/subject-split validation
3. Phase 7-8: Rep counter (Python + TS parity), generated_angle_configs.json, ONNX/int8 export
4. Phase 9: Integrate behind FEATURE_LOCAL_ML with fallback
5. Resolve blocker B1: Record own videos (≥3 subjects × ≥5 clips × 20 priority exercises)

## Deliverables Status

| Deliverable | Status |
|-------------|--------|
| `ml/` code package + `ml/README.md` | ✅ Created |
| `ml/models/*` artifacts + `manifest.json` | 🔴 **INVALID: synthetic-trained, do not ship** (deleted, will rebuild) |
| `ml/reports/STATUS_REPORT.md` | ✅ Created |
| Integrated code on branch `feat/on-device-pose-ml` | ✅ On feat/on-device-pose-ml branch |
| `docs/ml/ARCHITECTURE.md` explaining pipeline | ✅ Included in STATUS_REPORT.md |
| PR description | Pending (on feat/on-device-pose-ml branch) |

## Key Output Files (Phases 0-3)

| File | Description |
|------|-------------|
| `ml/PROGRESS.md` | Phase-by-phase progress tracking |
| `ml/ENVIRONMENT_REPORT.md` | Hardware/OS/repo analysis |
| `ml/STATUS_REPORT.md` | **Status report** (renamed from FINAL_REPORT.md) |
| `ml/BLOCKERS.md` | 5 active blockers |
| `ml/DATA_LICENSES.md` | License verification log |
| `ml/reports/env_smoke.txt` | Environment smoke test output |
| `ml/reports/mapping_coverage.md` | Catalog mapping coverage |
| `ml/reports/mapping_review.csv` | 442 exercises needing review |
| `ml/reports/gif_download_manifest.json` | 1324 GIF download manifest |
| `ml/reports/keypoint_extraction.log` | Keypoint extraction pipeline log |
| `ml/data/exercisedb_catalog.json` | 1500 ExerciseDB exercises |
| `ml/data/exercise_ml_map.json` | ML metadata mapping for all 1500 exercises |
| `ml/scripts/10-40.py` | 10 numbered pipeline scripts |
| `ml/requirements.txt` | Pinned dependencies |
| `ml/Makefile` | Standard targets |

## Remaining Work (Phases 5-9)

1. **Fix keypoint extraction**: Alternative approach for MediaPipe 1.2.2
2. **Record own videos** (B1): ≥3 subjects × ≥5 clips × 20 priority exercises
3. **Phase 5**: Augmentation pipeline
4. **Phase 6**: Model training and evaluation
5. **Phase 7-8**: Rep counter, generated_angle_configs.json, ONNX/int8 export
6. **Phase 9**: FEATURE_LOCAL_ML integration with fallback

## Summary

Phases 0-3 are fully complete with verified outputs. Phase 4 (keypoint extraction) is documented but not yet operational due to MediaPipe API constraints in the current environment. Phases 5-8 are designed and ready to proceed once Phase 4 is resolved. All metrics are marked "validated on public/GIF data only" until real recordings arrive (blocker B1).

**Total GIFs downloaded: 1324/1500 (88% coverage)**
**Total exercises mapped: 1500 with 29 taxonomy patterns**
**Total mapping tests passing: 7/7**

## Pattern model review — 2026-11-16 (Phases 1-9)

| Phase | Status | Evidence |
|-------|--------|----------|
| 1: Diagnose pattern_v1 | Done | `reports/PATTERN_V1_DIAGNOSIS.md`, `reports/pattern_v1_diagnosis.json` |
| 2: Dataset audit | Done | `reports/PATTERN_V1_DATA_AUDIT.md`, `reports/label_review.csv` |
| 3: Recording pipeline | Backend done | `backend/DATASET_PIPELINE.md`; API + tests pass; mobile screen not mounted |
| 4: Dataset expansion | Done | `reports/DATASET_EXPANSION.md` — no additional training-legal dataset found |
| 5: Architecture experiments | Done | `reports/PATTERN_V2_EXPERIMENTS.md` — 11 runs, all within fold noise |
| 6: INT8 degradation | Resolved (format) | `reports/QUANTIZATION.md` — dynamic quant was the cause; static QDQ is at parity |
| 7: v2 acceptance | Rejected | `reports/PATTERN_V2_ACCEPTANCE.md` — G4 far off, no promotion |
| 8: Integration safety | Held | production ONNX files unmodified; experimental model isolated |
| 9: Reporting | Done | this file, `BLOCKERS.md`, manifests |

Gate changes:

| Gate | Target | Actual | Status |
|------|--------|--------|--------|
| G4 | macro-F1 >= 0.85 | 0.359 (v1), 0.463 (best candidate) | fail |
| G8 | quantised drop <= 1.5 pts, < 1 MB | static QDQ: +0.001 val, 178 KB; dynamic: -0.279 | format fixed |
| G9 | Python/TS parity | ONNX export parity 1.9e-6 only | export only |
| G11 | end-to-end device | not run | not evaluated |

Root cause of the low accuracy is data, not architecture: 3 of 7 classes have
4-6 identities, all footage is one camera condition, and the effective test set
is 5 people. Architecture changes (attention, GRU, TCN, window size, focal loss,
label cleaning) all landed inside between-fold noise.
