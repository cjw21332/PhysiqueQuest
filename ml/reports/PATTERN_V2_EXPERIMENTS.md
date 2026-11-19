# Pattern model experiments and v2 decision (Phases 5 and 7)

Harness: `ml/scripts/76_experiments.py`; per-experiment records in
`ml/reports/experiments/*.json`, ranking in `summary.json`.

## Protocol (fixed before the runs)

- **Test subjects frozen** to the five people pattern_v1 was evaluated on
  (`04996ace`, `17e2d98f`, `5e3a8d78`, `ce0fbe3f`, `fcd2886c`). A candidate is
  compared with v1 on identical held-out windows.
- **Model selection only on 4-fold subject-grouped CV** over the other 23
  subjects. No test window informed any choice below.
- One change per experiment; same augmentation, optimiser and early stopping.
- Data integrity fixes applied to every run: subject ids canonicalised to the
  8-char prefix (28 subjects, not 30) and the byte-identical duplicate clip
  dropped (4,889 windows instead of 4,906).

## Results (val macro-F1, 4 folds, seed 7)

| Experiment | Change | Mean ± sd | Δ vs baseline |
|---|---|---|---|
| e9_clean_labels | drop 10 ambiguous clips from train/val | **0.4790 ± 0.1000** | +0.055 |
| e6_window32 | 32-frame windows (2.1 s) | 0.4430 ± 0.1058 | +0.019 |
| e7_no_class_weights | unweighted CE | 0.4311 ± 0.1043 | +0.008 |
| e3_gru | 2-layer GRU | 0.4265 ± 0.0693 | +0.003 |
| e5_window64 | 64-frame windows | 0.4240 ± 0.1410 | +0.001 |
| e0_v1_baseline | v1 architecture | 0.4234 ± 0.1006 | — |
| e2_attention | attention pooling over time | 0.4234 ± 0.0983 | +0.000 |
| e10_maxavg | mean+max pooling | 0.4230 ± 0.0907 | −0.000 |
| e8_focal | focal loss (γ=2) | 0.4156 ± 0.1080 | −0.008 |
| e4_tcn | dilated TCN + attention | 0.4153 ± 0.1022 | −0.008 |
| e1_no_visibility | drop the visibility column | 0.3543 ± 0.0606 | **−0.069** |

## The differences are not real

Per-fold paired deltas against the baseline:

| Experiment | Fold 0 | Fold 1 | Fold 2 | Fold 3 | Mean |
|---|---|---|---|---|---|
| e9_clean_labels | +0.289 | −0.244 | +0.125 | +0.052 | +0.055 |
| e6_window32 | −0.012 | +0.018 | +0.117 | −0.046 | +0.019 |
| e3_gru | +0.040 | −0.059 | +0.123 | −0.091 | +0.003 |
| e2_attention | −0.025 | −0.014 | +0.058 | −0.019 | +0.000 |

The best-looking change (`e9`) reverses sign between folds 0 and 1. With four
folds and 7 classes, the between-fold spread (sd ≈ 0.10) is larger than every
effect measured. Reporting "clean labels improve macro-F1 by 5.5 points" would be
noise-fitting, so it is not claimed.

Two conclusions that *are* supported because the sign is consistent:

1. **The visibility column is useful**: dropping it costs 0.069 mean and every
   fold is below baseline. Whatever the column encodes after normalisation, the
   model uses it. Do not remove it.
2. **No architecture change rescued the model.** Attention, GRU, TCN, window
   length, loss and label cleaning all land inside ±0.02 of the baseline.

## Why: the bottleneck is identities, not architecture

The same data explains it:

- 4 of 7 classes have 4–6 identities; `lateral_raise` has 4 total.
- Per-subject test accuracy spans 0.072–1.000 (diagnosis report).
- A model that memorises its training subjects shows val F1 ≈ 0.94 on those
  subjects (final attention run) and 0.46 on new ones.

No sequence model can learn a class from one person. The controlled experiment
set therefore supports the audit conclusion rather than contradicting it.

## Diagnostic model kept for reference (not a release)

`ml/models/experimental/attention_w48/` — trained on all 23 non-test subjects,
evaluated once on the frozen test set.

| Metric | pattern_v1 | attention_w48 |
|---|---|---|
| Test accuracy | 0.469 | **0.542** |
| Test macro-F1 | 0.359 | **0.463** |
| Parameters | 168,071 | 168,200 |
| Single-frame probe (test acc) | 0.4375 | 0.4601 |
| Gap real-window − single-frame | +0.031 | **+0.082** |
| Time-reversed probe | 0.4677 | 0.5582 |

Per class (test F1): cardio 0.454, core_flexion 0.478, core_isometric 0.297
(from 0.046), hinge 0.697, horizontal_push 0.567, lateral_raise 0.000, squat 0.746.

Interpretation:

- The attention model **does** use temporal structure (single-frame gap 8.2
  points vs 3.1 for v1) and fixes much of the `core_isometric` collapse. That
  validates the diagnosis.
- But its +0.073 test accuracy is inside the ±0.10 fold noise, so it is **not**
  evidence of a general improvement. It is one favourable draw of five subjects.
- Time-reversed input scoring *higher* (0.558) shows it uses order-sensitive
  statistics, not the causal direction of a rep. A rep-phase model would be
  penalised by reversal.

## Decision (Phase 7)

**Do not release `pattern_v2`.** No candidate cleared a defensible bar:

- G4 target macro-F1 ≥ 0.85; best candidate 0.463.
- No experiment beat the baseline beyond between-fold noise.
- The diagnosis' root cause (too few identities per class, single camera
  condition) is untouched by architecture work.

`pattern_v1` remains the reference baseline, `models/experimental/attention_w48`
is archived as evidence, and `models/cnn1d.onnx` / `gru.onnx` are untouched.

## What would justify a v2

1. ≥8 identities per class from the PhysiqueQuest contribution pipeline (Phase 3),
   with ≥2 camera placements and both orientations.
2. Then re-run this harness: grouped CV with ≥5 folds, and only promote a
   candidate that beats `cnn_avg` by more than the fold sd on at least 4 of 5
   folds.
3. Keep the frozen test people frozen until that promotion decision is made.
