# PoseTracker next steps

## Decision

**BLOCKED BY INSUFFICIENT DATA** for a trustworthy exercise-recognition model improvement. The fresh attention experiment performed worse than the baseline in three of four subject-grouped folds, and the dataset is too small and narrow for a production claim. The rep counter also has a separate red regression suite that should be investigated before model work is used to improve counting.

## Ordered work

1. **Repair counter test failures with focused diagnosis.** Reproduce the eight failing `genericRepCounter` cases, identify whether the production counter or test expectations are wrong, and add narrowly scoped regression coverage. Do not change thresholds blindly. Test camera/device behavior after a justified fix.
2. **Version the feature contract.** Keep v1 checkpoints and v1 extractor semantics immutable. Add a versioned v1.1 extractor that transforms coordinates only and preserves confidence values; implement one shared preprocessing contract or explicit parity fixtures for Python and mobile. Verify tensor order, shape, missing landmarks, and bounds.
3. **Improve data before training.** Collect opt-in, consented and pseudonymized landmark sequences with ground-truth exercise/pattern labels from diverse consenting people, cameras, angles, environments, body types, occlusion and equipment conditions. Include unknown/unsupported and transition examples. Obtain explicit consent before any collection; do not use ordinary workout history or upload private recordings.
4. **Establish label and split quality.** Review labels with an annotation guide and independent second reviewer. Search exact and near duplicates. Group by participant and recording session. Reserve a sufficiently large untouched participant holdout; use participant-grouped validation for model selection.
5. **Re-run controlled comparisons.** Reproduce the current baseline first on corrected versioned features, then vary one factor at a time (class balancing, augmentation, temporal architecture). Record per-class precision/recall/F1, confusion matrix, uncertainty across participant folds and calibration/unknown rejection. Keep the final holdout untouched.
6. **Keep roles separated.** Exercise recognition, repetition counting, and form cues have different targets. Build labeled rep-phase/rep-count data before proposing an ML counter. Keep 2D form cues transparent and exercise/view-specific; avoid medical or universal-form claims.
7. **Only then evaluate deployment.** Define Android tensor/runtime integration and fallback; measure end-to-end latency, memory, thermal behavior, offline operation and outputs on OPPO CPH2591. Exercise camera, landmark, rep, uploaded-video, save-review, auth/history isolation, and consent regression. No real workout save during validation.

## Current boundaries

- Existing production model/runtime artifacts remain unchanged.
- No candidate is ready for controlled deployment.
- Coverage remains 0 fully supported, 831 partial, 127 not validated, 542 unsupported.
- ExerciseDB GIF and RepCount-A licensing must be resolved before using those sources in training or redistribution.
- The codebase's dataset contribution UI is not mounted; contribution implementation must be completed and reviewed before collecting product data.

## Reproduction commands

From PowerShell:

```powershell
cd "C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml"
.venv\Scripts\python.exe scripts\76_experiments.py --experiments e0_v1_baseline,e2_attention --folds 4 --epochs 30 --patience 6 --seeds 123 --report reports\experiments\pose_audit_20261117
.venv\Scripts\python.exe reports\experiments\pose_audit_20261117\snapshot.py
```

The first reproduces the train/validation grouped comparison on the current loader; the second refreshes artifact hashes, data fingerprint, coverage, machine details, and desktop latency. Results are recorded in [`POSETRACKER_MODEL_EXPERIMENTS.md`](POSETRACKER_MODEL_EXPERIMENTS.md).
