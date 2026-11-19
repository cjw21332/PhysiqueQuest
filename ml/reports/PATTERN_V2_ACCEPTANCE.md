# pattern_v2 acceptance review (Phases 7 and 8)

Date: 2026-11-16. Decision: **REJECTED — no model is promoted.** `pattern_v1`
stays the reference baseline and the production contracts are untouched.

## 1. Gate status

| Gate | Target | pattern_v1 | Best candidate (attention_w48) | Status |
|---|---|---|---|---|
| G4 pattern macro-F1 (held-out subjects) | ≥ 0.85 | 0.359 | 0.463 | **Fail** |
| G4 accuracy | — | 0.469 | 0.542 | — |
| G5 open-set false-accept | ≤ 10% | not measured | not measured | Not evaluated |
| G8 quantised degradation | ≤ 1.5 pts | dynamic int8 −10.9 pts | static QDQ −0.1 pts | **Pass for static QDQ** |
| G8 model size | < 1 MB | 0.67 MB FP32 / 0.18 MB int8 | 0.67 / 0.18 MB | Pass |
| G9 Python/TS parity | identical | ONNX export parity 1.9e-6 | 1.9e-6 | Export-only check |
| G11 end-to-end device | pass | not run | not run | **Not evaluated** |

G4 is not close. Every experiment in `PATTERN_V2_EXPERIMENTS.md` landed inside
between-fold noise, so promoting the 0.463 candidate would be selection on a
favourable five-subject draw.

## 2. Required reporting for the candidate

Held-out test: 928 windows, **5 people** (`04996ace`, `17e2d98f`, `5e3a8d78`,
`ce0fbe3f`, `fcd2886c`), never used for architecture, loss, feature, window or
quantisation decisions.

| Metric | pattern_v1 | attention_w48 |
|---|---|---|
| Accuracy | 0.469 | 0.542 |
| Macro-F1 | 0.359 | 0.463 |
| Parameters | 168,071 | 168,200 |
| ONNX FP32 size | 0.67 MB | 0.67 MB |
| Static INT8 size | 0.18 MB | 0.18 MB |
| FP32 latency (desktop CPU, batch 1) | 0.12 ms | 0.11 ms |
| INT8 static latency | 0.06 ms | 0.08 ms |
| INT8 dynamic latency (old artifact) | 1.47 ms | 1.22 ms |
| RSS on load + one inference (FP32) | 10.1 MB | 2.6 MB |
| RSS on load + one inference (INT8 static) | 1.1 MB | 0.5 MB |
| Quantisation delta (val macro-F1) | −0.279 dynamic / +0.001 static | −0.299 dynamic / −0.002 static |

Latency and memory are desktop CPU measurements. **No phone latency has been
measured**; do not quote these as device numbers.

### Per-class (test)

| Class | v1 F1 | candidate F1 | support | test subjects |
|---|---|---|---|---|
| cardio_dynamic | 0.341 | 0.454 | 208 | 2 |
| core_flexion | 0.541 | 0.478 | 88 | 3 |
| core_isometric | 0.046 | 0.297 | 95 | 1 |
| hinge | 0.600 | 0.697 | 338 | 2 |
| horizontal_push | 0.349 | 0.567 | 19 | 1 |
| lateral_raise | 0.000 | 0.000 | 19 | 1 |
| squat | 0.635 | 0.746 | 161 | 3 |

`lateral_raise` remains at 0.000 for both: the class has four identities in the
whole dataset and one in the test split. No model can fix that.

### Subject-level (candidate)

Per-subject accuracy is in `ml/models/experimental/attention_w48/metrics.json`
and the v1 equivalent in `pattern_v1_diagnosis.json`. Range across the five test
people: 0.072–1.000 (v1) and 0.211–1.000 (candidate). The spread, not the mean,
is the honest summary.

## 3. Integration safety (Phase 8)

- `ml/models/cnn1d.onnx` and `ml/models/gru.onnx` were **not modified**; `git
  status ml/models` shows only new untracked directories (`pattern_v1/`,
  `experimental/`). Their 10-class FEATURE_SPEC contract is untouched.
- No app/mobile code imports `pattern_v1` or the experimental model. Nothing was
  wired into inference.
- New artefacts are versioned by directory and carry a manifest or metrics file:
  - `models/pattern_v1/manifest.json` (baseline, provenance, metrics, limits);
  - `models/experimental/attention_w48/metrics.json` (config, test metrics,
    temporal probe, parameters).
- Rollback is trivial because nothing was replaced: deleting the two new
  directories restores the previous state exactly.
- A promoted model would need: versioned manifest, input/output contract
  (48×132 float32 → 7 logits), preprocessing spec (FEATURE_SPEC v1.1), licence
  and provenance, held-out metrics, and a rollback path in the bundle. None of
  that is claimed for a model that fails G4.

## 4. Remaining blockers

1. **Identities per class.** 4–6 subjects for three of seven classes; a
   subject-disjoint test fold leaves one person per class. This is the primary
   blocker for G4 and cannot be solved with architecture.
2. **One camera condition.** All 231 clips are 1920×1080 landscape 30 fps. Phone
   contributions are portrait and handheld; untested distribution shift.
3. **No PhysiqueQuest recordings.** The contribution pipeline (Phase 3) exists,
   but its mobile screen is not mounted and no clip has been collected.
4. **Label ambiguity** in ~10 of 231 clips (concentrated in the weakest classes).
   The clean-label experiment did not show a reliable gain, but the labels still
   bound achievable accuracy.
5. **No device measurement** for latency, memory or battery, and no G5/G11 work.
