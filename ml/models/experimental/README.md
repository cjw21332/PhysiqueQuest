# Experimental models — not for release

`attention_w48/` is the diagnostic candidate from the Phase 5 experiments
(`ml/reports/PATTERN_V2_EXPERIMENTS.md`). It exists to show that temporal pooling
changes behaviour, not to ship.

- Config: `cnn_attention` (2 conv layers + learned attention pooling), 48×132,
  7 classes, trained on the 23 non-test subjects for 30 epochs.
- Test (5 frozen subjects): accuracy 0.542, macro-F1 0.463.
- It is **not promoted**: the CV gain over `pattern_v1` was inside fold noise and
  G4 (≥0.85) is far out of reach.

`cnn1d.onnx` in this directory is a different 7-class contract from
`ml/models/cnn1d.onnx` (10 classes). Do not point app code at it.

Nothing here may replace `ml/models/cnn1d.onnx` or `ml/models/gru.onnx` without a
new acceptance review (`ml/reports/PATTERN_V2_ACCEPTANCE.md`).
