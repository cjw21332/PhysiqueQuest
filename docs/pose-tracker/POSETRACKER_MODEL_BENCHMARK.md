# PoseTracker benchmark

Audit date: 2026-11-17. Results distinguish historic held-out reports, fresh grouped CV, and desktop-only runtime timings.

| Metric | Existing baseline | Best candidate | Difference |
|---|---:|---:|---:|
| Validation accuracy | N/A for the fresh grouped CV aggregate | N/A | N/A |
| Fresh grouped-CV macro-F1 | 0.4436 ± 0.0891 (v1 CNN) | 0.4220 ± 0.0827 (attention) | −0.0216 mean |
| Test accuracy | 0.4688, historical v1 report | N/A (test set held out) | N/A |
| Test macro-F1 | 0.3589, historical v1 report | N/A | N/A |
| Model size | 671,572 B v1 FP32 ONNX | 672,600 B attention FP32 ONNX | +1,028 B |
| Desktop CPU ONNX p50 / p95, batch 1 | v1: 0.1317 / 0.1571 ms | attention: 0.1436 / 0.1838 ms | +0.0119 / +0.0267 ms |
| Android latency/memory | N/A; no phone measurement | N/A; not integrated | N/A |

Fresh grouped CV is train/validation-only and uses the same four subject folds. The best candidate here is the baseline, because attention underperformed. Historic test scores come from existing artifacts/reports and must not be compared as if measured in the fresh run. Desktop ONNX numbers use 100 warmed batch-one CPU inferences and are not mobile estimates; repeated snapshots varied, so the refreshed snapshot values are presented without implying meaningful speed differences. Snapshot hashes, environment, inputs/outputs, and frozen test IDs are in [`audit_snapshot.json`](../../ml/reports/experiments/pose_audit_20261117/audit_snapshot.json).

### Historical context

The v1 training report shows approximately 0.947 training accuracy and approximately 0.457 validation accuracy; these are not evidence of broad generalization. The existing v1 held-out report gives 0.4688 accuracy and 0.3589 macro-F1. An earlier attention report used five held-out people and showed higher values, but the project acceptance report rejected it due to limited people/test evidence and uncertainty. Fresh grouped CV did not reproduce a reliable advantage.
