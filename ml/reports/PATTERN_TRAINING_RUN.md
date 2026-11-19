# Pattern Classifier Training Run — 2026-11-16

## Status

- **Run:** `ml/scripts/72_train_pattern.py` on PushUpBench (CC-BY-4.0) only.
- **Outcome:** completed; model written to `ml/models/pattern_v1/` (`cnn1d.onnx` + `cnn1d_int8.onnx` + `manifest.json`).
- **Honest verdict:** baseline quality only (test macro-F1 0.36). Not a ship candidate.

## Data

- Videos: 231 (all 231 extracted to `ml/data/keypoints_pushupbench/`).
- Distinct subjects: 26 (hash prefix of filename).
- Licence: CC-BY-4.0 — training + redistribution permitted with attribution.
- Excluded datasets: RepCount-A (local evaluation only, no shipped weights), ExerciseDB GIFs (eval only), own recordings (0 clips).

## Preprocessing (matches `ml/FEATURE_SPEC.md`)

Pad 1.5x -> unpad -> mid-hip centering -> unit torso scale -> 15 fps resample. Conformance tests in `ml/tests/test_preprocessing_spec.py` (6/6 pass).

## Split (subject-disjoint, seed 7)

- Train: 21 subjects / 148 videos / 3291 windows
- Val:   4 subjects / 37 videos / 687 windows
- Test:  5 subjects / 42 videos / 928 windows
- Excluded classes: `curl`, `triceps_extension` (fewer than 4 distinct subjects).
- Trained classes (7): cardio_dynamic, core_flexion, core_isometric, hinge, horizontal_push, lateral_raise, squat.
- `horizontal_pull` is absent (not present in PushUpBench).

## Training

- Model: CNN1DClassifier (168,071 params) from `pq_ml.models`, 48x132 input, stride 24.
- Loss: cross-entropy with class weights.
- Early stop on val macro-F1; best epoch 28; stopped at epoch 38 (patience 12).

## Metrics (within-dataset, PushUpBench subjects only)

- Best val macro-F1: 0.3023
- Test accuracy: 0.4688
- Test macro-F1: 0.3589

Per-class test F1: cardio_dynamic 0.34, core_flexion 0.54, core_isometric 0.05, hinge 0.60, horizontal_push 0.35, lateral_raise 0.00, squat 0.63.

- lateral_raise: 0.00 (only 4 subjects, 6 videos; test subject not represented).
- core_isometric: 0.05 (confused with cardio_dynamic).
- int8 quantization: macro-F1 0.25 (drop 0.11 vs float) — exceeds the <=1.5 point gate; int8 not recommended for this model as-is.
- ONNX export parity: max |torch - onnx| = 1.91e-06.

## Known limitations (honest)

1. Not validated on PhysiqueQuest users; metrics are within-dataset only.
2. Only 7 of the 10 FEATURE_SPEC classes covered; curl and triceps_extension excluded.
3. int8 quantization degrades macro-F1 by 0.11 (gate <=1.5 pts) — fail.
4. No rep counting or form assessment trained; this model classifies movement pattern only.
5. No user-data validation (B1 blocker still open: 0 own recordings).

## Next steps

1. Record own videos (B1): >=3 subjects x >=5 clips x 20 priority exercises.
2. Add augmentation pipeline (Phase 5).
3. Re-train with real recordings; target gate G4 >=0.85 macro-F1.
4. Investigate int8 calibration (quantization-aware or better representative dataset) before shipping int8.
5. Integrate pattern_v1 into FEATURE_LOCAL_ML with fallback; do NOT overwrite cnn1d.onnx/gru.onnx (10-class contract).
" 

## Superseded by the Phase 1 review (2026-11-16)

Read `PATTERN_V1_DIAGNOSIS.md` before using any number above.

- The 0.36 macro-F1 is not primarily a tuning problem. A single repeated frame
  scores 0.4375 vs 0.4688 for the real window, so the model is a static-pose
  classifier; global average pooling removes time order.
- The effective test set is 5 subjects, not 928 windows; per-subject accuracy
  spans 0.072-1.000.
- `cnn1d_int8.onnx` was produced with dynamic quantisation, which drops val
  macro-F1 by 0.279 and is slower than FP32. `QUANTIZATION.md` documents the
  static-QDQ replacement that meets G8.
- A byte-identical clip and two subject-id aliases were found across the split.
  The corrected split is used in `76_experiments.py`.
