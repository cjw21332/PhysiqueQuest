# RepCount-A status — 2026-11-11

License blocker resolved by developer approval for local evaluation only; see DATA_LICENSES.md.

Lance access works: train=758, validation=131, test=152. The second mirror returned HTTP Error 401: Unauthorized. No three-attempt failure occurred. No evaluation has run.

## ML pipeline run — 2026-11-16 (pattern classifier baseline)

- Trained `ml/models/pattern_v1/cnn1d.onnx` (+ int8) on PushUpBench (CC-BY-4.0) only.
- Test macro-F1 0.36 (gate G4 target 0.85): NOT met.
- int8 quantization drops macro-F1 by 0.11 (gate G8 target <=1.5 pts): NOT met.
- Excluded classes: curl, triceps_extension (too few subjects); horizontal_pull absent.
- No user-data validation (B1 still open: 0 own recordings).
- Report: `ml/reports/PATTERN_TRAINING_RUN.md`; manifest: `ml/models/pattern_v1/manifest.json`.


## Pattern review — 2026-11-16

- G4 remains blocked by identity count, not architecture: 4-6 subjects for three of seven classes.
- The shipped INT8 artifact used dynamic quantisation, which is the cause of the -0.11 drop; static QDQ meets the gate. `72_train_pattern.py` still exports dynamic int8 and must be changed before any model ships.
- Subject aliasing (8-char vs 32-char hashes) and one byte-identical duplicate across train/val were found and fixed in the experiment split code, not in the training script.
- Contribution pipeline backend is complete and tested; the mobile screen is not mounted and no clip has been collected.
- No additional training-legal dataset exists for these classes (all reviewed datasets are non-commercial or agreement-gated).
- pattern_v2 was not released: reports/PATTERN_V2_ACCEPTANCE.md.
