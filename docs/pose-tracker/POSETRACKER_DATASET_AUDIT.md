# PoseTracker dataset and feature audit

Audit date: 2026-11-17. See [`audit_snapshot.json`](../../ml/reports/experiments/pose_audit_20261117/audit_snapshot.json) for content fingerprint and exact per-class counts.

## PushUpBench snapshot

- 231 `.npz` keypoint exports and 231 raw MP4s are present.
- Source documentation identifies PushUpBench as CC-BY-4.0 (`ml/DATA_LICENSES.md`). Retain attribution and verify source terms before redistribution.
- Content fingerprint: `e329c6a8ebba60b8ebe9ae41a1037e5650f8e5e28ac0bd1ca5ba9ec1044c8000`.
- Corrected loader snapshot: 4,889 windows, 28 canonical subjects, 7 classes. It drops one exact duplicate and four low-detection windows. This supersedes older 4,906/26 figures for this loader state; manifests differ because aliases/dedup changed.

| Class | Windows | Subjects | Clips |
|---|---:|---:|---:|
| cardio_dynamic | 621 | 10 | 26 |
| core_flexion | 1,669 | 18 | 82 |
| core_isometric | 273 | 6 | 12 |
| hinge | 1,754 | 17 | 82 |
| horizontal_push | 119 | 5 | 5 |
| lateral_raise | 116 | 4 | 6 |
| squat | 337 | 6 | 13 |

The existing holdout IDs are `04996ace`, `17e2d98f`, `5e3a8d78`, `ce0fbe3f`, and `fcd2886c`; they were excluded from the fresh cross-validation experiment. Subject grouping is preferable to random frame/window splits because windows from one person/clip are correlated. Class imbalance and very small subject counts make per-class estimates noisy. The set does not establish robustness to phone camera angles, lighting, body/limb occlusion, clothing, equipment, body proportions, or home/gym recording environments. Labels are broad movement-pattern classes, not exercise-specific form labels or rep ground truth. No independent annotation adjudication was performed.

## Other data and licensing

Repository contains additional `keypoints_cached`, `keypoints_raw_gif`, `keypoints_repcount`, `keypoints_real`, and `keypoints_real_video` sources. ExerciseDB GIF licensing is unresolved/TBD in `ml/DATA_LICENSES.md`; RepCount-A terms are unknown. Those sources were not mixed into classifier training. They may support local counter harnesses only under existing project restrictions. No sufficient consented PhysiqueQuest user recording/label set was found. Do not use routine user sessions for training; obtain explicit opt-in, purpose/retention disclosure, and ground-truth labeling first.

## Feature compatibility defect

The v1 extractor `ml/scripts/71_extract_videos.py::unpad_and_normalize` computes normalized coordinates using hip center and torso scale over the entire four-column landmark tensor. The fourth column is visibility/confidence, which should remain bounded confidence rather than be translated/scaled like a coordinate. Audit values show this currently becomes negative/unbounded. `ml/FEATURE_SPEC.md` contains a v1.1 correction note and `mobile/datasetContribution.mjs` preserves raw visibility, but Python training still produces v1 semantics. Existing v1 model inputs/checkpoints must remain labeled v1 and cannot consume v1.1 tensors without retraining. A shared executable preprocessing implementation and parity tests should be established; the spec currently points at absent `shared/pose-features.ts`.

## Split and leakage conclusions

The refreshed loader canonicalizes subject aliases and removes one exact duplicate. The five-person test set stayed untouched in this audit. This is a stronger protocol than random windows, but five test people remain too few to make a deployment claim. Near-duplicate recording review, label verification, and independent annotation review are incomplete. The fresh experiment is train/validation-only grouped CV, not a final test-set evaluation.
