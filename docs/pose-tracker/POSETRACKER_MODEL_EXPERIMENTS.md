# PoseTracker controlled experiments

Run directory: [`ml/reports/experiments/pose_audit_20261117`](../../ml/reports/experiments/pose_audit_20261117). Full fold results are in `summary.json`, `e0_v1_baseline.json`, and `e2_attention.json`; the provenance snapshot is `audit_snapshot.json`. Existing model/checkpoint artifacts were not overwritten and no candidate was exported.

## Rationale and protocol

The production tracker does not use a learned PQ classifier. A small offline comparison was still justified to check whether the existing temporal attention candidate improved broad exercise-pattern classification over v1. We used only available licensed PushUpBench data and the corrected subject-canonicalized/deduplicated loader; the five frozen test subjects were excluded. Four-fold subject-grouped cross-validation used one seed (`123`), 30 maximum epochs, early stopping patience 6, weighted cross entropy, label smoothing 0.05, AdamW at 0.001, and the harness's existing augmentation. Runs were sequential CPU with four OMP/MKL threads. The GPU was available but unused; no dependencies or system settings were changed.

Command from repository root (PowerShell):

```powershell
cd "C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml"
.venv\Scripts\python.exe scripts\76_experiments.py --experiments e0_v1_baseline,e2_attention --folds 4 --epochs 30 --patience 6 --seeds 123 --report reports\experiments\pose_audit_20261117
```

The audit also re-ran the read-only inventory/timing snapshot:

```powershell
cd "C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\ml"
.venv\Scripts\python.exe reports\experiments\pose_audit_20261117\snapshot.py
```

## Results

| Experiment | Fold macro-F1 | Mean ± SD | Outcome |
|---|---|---:|---|
| e0 v1 CNN baseline | 0.3104, 0.5546, 0.4277, 0.4818 | 0.4436 ± 0.0891 | Baseline |
| e2 attention temporal CNN | 0.2837, 0.5027, 0.4470, 0.4547 | 0.4220 ± 0.0827 | Lost 3/4 paired folds; mean delta −0.0216 |

Paired fold deltas (attention − baseline): −0.0267, −0.0519, +0.0193, −0.0271. This is a negative result, not a reliable improvement. Fold-to-fold variation is high relative to the mean difference. This was not a test-set comparison; test metrics are intentionally not reported for this run.

## Acceptance

No candidate meets promotion criteria. There is no candidate model export, no app integration, and no phone regression. Do not treat the older five-person held-out results as repeated tuning evidence. The main near-term work is correct/versioned feature extraction, counter regression diagnosis, data/label expansion, and evaluation design; then a fresh experiment may be planned.
