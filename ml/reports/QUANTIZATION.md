# INT8 quantisation investigation (Phase 6)

Harness: `ml/scripts/77_quantize_experiments.py`. Raw results:
`ml/reports/quantization_v1.json`, `ml/reports/quantization_attention.json`.
Artefacts: `ml/models/pattern_v1/quantized/`, `ml/models/experimental/attention_w48/quantized/`.

`pattern_v1` shipped `onnxruntime.quantization.quantize_dynamic`, which drops
test macro-F1 by 0.109 — far outside the ≤0.015 gate. This run explains why and
tests the alternatives.

## Results — pattern_v1 (48×132, 7 classes)

| Format | Size | Val macro-F1 | Test macro-F1 | Latency (batch 1) |
|---|---|---|---|---|
| FP32 | 672 KB | 0.776 | 0.359 | 0.12 ms |
| FP16 | 337 KB | 0.776 | 0.359 | 0.13 ms |
| INT8 dynamic (shipped) | 173 KB | **0.497** | **0.250** | 1.47 ms |
| INT8 dynamic, per-channel | 173 KB | 0.497 | 0.250 | 1.48 ms |
| INT8 dynamic + Conv | 173 KB | 0.497 | 0.250 | 1.45 ms |
| INT8 static QDQ, class-balanced calibration | 178 KB | **0.777** | **0.363** | **0.06 ms** |
| INT8 static QDQ, symmetric activations | 178 KB | 0.777 | 0.363 | 0.06 ms |
| INT8 static QDQ, per-tensor | 175 KB | 0.781 | 0.361 | 0.05 ms |

Same experiment on the attention model (val macro-F1 0.940 → test 0.463 FP32):

| Format | Size | Val | Test | Latency |
|---|---|---|---|---|
| FP32 | 673 KB | 0.940 | 0.463 | 0.11 ms |
| INT8 dynamic | 175 KB | 0.641 | 0.397 | 1.22 ms |
| INT8 static QDQ | 182 KB | 0.938 | 0.462 | 0.08 ms |

## Findings

1. **Dynamic quantisation is the wrong tool here.** It quantises weights
   per-tensor and activations at run time, costs 0.28 val macro-F1 on a model
   this small, and is **10–20× slower** than FP32 on CPU (1.2–1.5 ms vs
   0.06–0.12 ms). A 173 KB file that is slower and less accurate than FP32 is not
   a mobile win. This alone explains the G8 failure; it is not a calibration
   problem.
2. **Static QDQ with class-balanced calibration is at parity.** Val 0.777 vs
   0.776 FP32 (Δ +0.001), test 0.363 vs 0.359 (Δ +0.004), 0.06 ms, 178 KB.
3. **Calibration coverage matters for static QDQ.** An unstratified calibration
   sample gave val 0.761 (−0.015, exactly at the gate edge); sampling per class
   removed the gap. The script now samples class-balanced by default.
4. **Per-tensor is already fine** at this size (0.781 val), so per-channel is not
   required — but it costs nothing to keep.
5. **FP16 is a safe fallback**: identical metrics to FP32, half the size (337 KB),
   similar latency. Use it where INT8 kernels are unavailable (older devices,
   non-x86 builds).

## Gate G8 assessment

Gate: quantised degradation ≤ 0.015 macro-F1 and size < 1 MB, using the val pool
for the format decision.

- FP32, FP16, static QDQ int8 (QUInt8, per-channel), static QDQ symmetric,
  static per-tensor all **pass**: max val delta +0.005, sizes 175–178 KB.
- Dynamic int8 **fails** (Δ −0.279 val, −0.109 test).

**Recommended mobile format: static QDQ INT8** (per-channel weights, uint8
activations, class-balanced calibration), with FP16 as the fallback. The size
budget is met (~178 KB).

This gate is about the *format*, and it can be met. It does not make the model
deployable: the model itself fails G4 (test macro-F1 0.359 vs 0.85).

## Changes to apply when a model is actually shipped

`72_train_pattern.py` still writes `cnn1d_int8.onnx` with `quantize_dynamic`.
It should be switched to `quantize_static` with:

- a calibration reader built from **class-balanced training windows** (not val,
  once val is used for early stopping — choose calibration from train);
- `QuantFormat.QDQ`, `per_channel=True`, `activation_type=QUInt8`,
  `weight_type=QInt8`;
- the same parity/eval script as above to prove Δ ≤ 0.015 before the artifact is
  copied into the app bundle.

Not changed in this pass because no model was released; changing the export path
now would silently alter the v1 artifact.
