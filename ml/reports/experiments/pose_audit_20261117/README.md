# Controlled PoseTracker experiment record

Run date: 2026-11-17. See the seven audit reports in `docs/POSETRACKER_*.md`.

## Hypothesis

An attention temporal CNN might improve broad movement-pattern generalization over the existing average-pooling CNN by modeling temporal order. No production path currently uses either model. The comparison used the same corrected subject-canonicalized/deduplicated PushUpBench loader, four grouped folds, seed 123, max 30 epochs, patience 6, weighted cross entropy, label smoothing 0.05, AdamW LR 0.001, and existing augmentation. The five frozen test participants were not loaded for evaluation/tuning.

## Reproduction (PowerShell)

```powershell
cd "C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml"
.venv\Scripts\python.exe scripts\76_experiments.py --experiments e0_v1_baseline,e2_attention --folds 4 --epochs 30 --patience 6 --seeds 123 --report reports\experiments\pose_audit_20261117
```

The controlled run was sequential CPU, `OMP_NUM_THREADS=4`, `MKL_NUM_THREADS=4`; GPU was available but intentionally unused. No package, system, CUDA, or driver changes. No candidate checkpoint was exported because it did not improve the baseline. Existing checkpoints were preserved.

## Outcome

- Dataset NPZ count: 231; fingerprint SHA-256 `e329c6a8ebba60b8ebe9ae41a1037e5650f8e5e28ac0bd1ca5ba9ec1044c8000`.
- 4,889 deduplicated windows, 28 canonical subjects, 7 classes.
- v1 CNN folds: 0.3104, 0.5546, 0.4277, 0.4818; mean 0.4436, SD 0.0891.
- Attention folds: 0.2837, 0.5027, 0.4470, 0.4547; mean 0.4220, SD 0.0827.
- Attention paired mean delta: −0.0216; lost three of four folds.
- Decision: reject candidate; no final test evaluation or mobile integration.

Raw run records: `summary.json`, `e0_v1_baseline.json`, `e2_attention.json`. `audit_snapshot.json` contains artifact SHA-256s, inventory, machine/runtime details, class counts, catalog coverage, and desktop CPU ONNX timing. Timing is not Android performance. No private user recording or workout history was accessed or saved.
