# PoseTracker model and pipeline audit

Audit date: 2026-11-17. This is a source-level audit plus a controlled offline comparison. The OPPO device was not exercised in this audit; no device or production integration claims are made.

## Architecture findings

Pose estimation, exercise selection, repetition detection, and form cues are separate concerns. MediaPipe Pose Landmarker Lite estimates 2D/3D landmarks. The exercise selection is user-driven and mapped to static pattern metadata. `shared/exerciseEngine.ts` and `shared/genericRepCounter.ts` implement deterministic angle/phase logic, visibility gating, smoothing, ROM and timing constraints. The app does not call a learned PhysiqueQuest classifier for live exercise recognition, rep counting, or form grading. Form checks are heuristics and must not be presented as clinical or biomechanically validated.

Android loads the Lite `.task` through the native Expo module. Browser camera inference has a separate MediaPipe JS worker and CPU delegate. Android camera callbacks nominally process fewer frames than preview; the native path throttles based on observed inference/thermal conditions. Uploaded video in the mobile PoseTracker is analyzed locally by sampling frames and reusing the deterministic pipeline. CameraCheck's backend video review is a distinct path and may use a configured external provider; it is not evidence of local PoseTracker behavior.

The dataset contribution code is explicit-consent gated and keypoint based, but the contribution UI is not mounted and there is no established pool of consented/labeled PhysiqueQuest recordings. Ordinary tracking was not found to upload user clips automatically.

## Quality and safety findings

1. **Training/inference are not one pipeline.** The experimental 48×132 features are not the raw landmarks consumed by the production deterministic counter. No PQ classifier runs on the Android live path.
2. **Visibility normalization defect remains in v1 extractor.** `ml/scripts/71_extract_videos.py::unpad_and_normalize` applies coordinate centering/scaling to all four values, including visibility. Audit samples had median visibility −1.06 and range −2.61 to −0.07. This breaks confidence semantics. Existing v1 checkpoints are tied to the flawed feature meaning; do not repair in place or mix corrected features with those checkpoints. Version a new feature schema and retrain/evaluate separately.
3. **The current rep-counter regression suite is red.** Targeted Vitest run had 8 failures in `shared/__tests__/genericRepCounter.spec.ts` across squat counts, partial reps, fault handling, visibility recovery, and long-gap behavior. Other selected engine/video pipeline suites passed. This audit did not make an unrelated production counter change; the failures need a focused bug investigation before any classifier work can improve rep counting.
4. **Coverage metadata is not evidence of accuracy.** Current generated catalog has 1,500/1,500 mapped IDs: 831 `PARTIALLY_SUPPORTED`, 127 `NOT_YET_VALIDATED`, 542 `UNSUPPORTED`, zero `FULLY_SUPPORTED`. Generated configuration or passing unit tests must not upgrade support status.
5. **The experimental classifier remains weak.** Pattern v1 has test macro-F1 0.3589 on the existing five-person holdout; training accuracy near 0.947 is not a generalization result. The attention model's old report uses only five test people and is not enough to establish reliable improvement.
6. **Dataset diversity is narrow.** PushUpBench is a single-source set of 231 clips with 28 canonical subjects and seven imbalanced movement classes. Class subject counts range from 4 to 18, and camera/environment diversity is not sufficient to establish performance across ordinary phone use.

## Limitations and pipeline audit

PushUpBench splits are person-grouped by the existing harness and the five test IDs were kept frozen during the fresh comparison. Historical training reports and manifests have inconsistent counts; the refreshed canonicalized window inventory is 4,889 across 28 subjects, after one exact duplicate and four low-detection windows are excluded. The original references to 4,906 windows/26 people are stale for this loader snapshot.

The exact data fingerprint, model hashes, CPU inference timings and environment are in [`audit_snapshot.json`](../ml/reports/experiments/pose_audit_20261117/audit_snapshot.json). Latency is desktop ONNX Runtime CPU microbenchmark only, not Android latency. RAM/VRAM availability was inspected; no model-training job was run on GPU because the controlled comparison used the existing CPU experiment harness with bounded thread count and did not require a system or dependency change.

No camera/video sample was sent to an external service for this audit. No workout history was saved. Existing checkpoints and runtime assets were preserved.
