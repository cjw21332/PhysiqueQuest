# pattern_v1 diagnosis — why 0.469 accuracy / 0.36 macro-F1

Generated from existing artefacts only, by `ml/scripts/73_diagnose_pattern.py`
(output: `ml/reports/pattern_v1_diagnosis.json`). No model was retrained.

Artefacts read:

- `ml/data/keypoints_pushupbench/*.npz` — 231 extracted sequences, 5,006 windows before class filtering.
- `ml/models/pattern_v1/cnn1d.onnx` — the trained float model, evaluated with ONNX Runtime.
- The split functions are **imported from** `ml/scripts/72_train_pattern.py`, so the evaluation uses exactly the training run's subject assignment (seed 7).

## Headline

| Split | Windows | Subjects | Videos | Accuracy | Macro-F1 |
|---|---|---|---|---|---|
| train | 3,291 | 21 | 148 | 0.947 | 0.883 |
| val | 687 | 4 | 37 | 0.457 | 0.302 |
| test | 928 | 5 | 42 | 0.469 | 0.359 |

The generalisation gap is 0.48 accuracy (train→test). But the more important
number is the **effective test sample size: 5 people**, not 928 windows. Windows
from one person are strongly correlated, so 928 windows do not give 928
independent observations.

## 1. Per-class performance (test)

| Class | Precision | Recall | F1 | Windows | Test subjects |
|---|---|---|---|---|---|
| cardio_dynamic | 0.407 | 0.293 | 0.341 | 208 | 2 |
| core_flexion | 0.561 | 0.523 | 0.541 | 88 | 3 |
| core_isometric | 0.086 | 0.032 | 0.046 | 95 | **1** |
| hinge | 0.719 | 0.515 | 0.600 | 338 | 2 |
| horizontal_push | 0.214 | 0.947 | 0.349 | 19 | **1** |
| lateral_raise | 0.000 | 0.000 | 0.000 | 19 | **1** |
| squat | 0.515 | 0.826 | 0.635 | 161 | 3 |

Three of seven classes are represented by a single test subject
(`core_isometric`, `horizontal_push`, `lateral_raise`). Their test F1 cannot be
read as generalisation — it is one person's style.

`horizontal_push` has recall 0.947 but precision 0.214: the model over-predicts
push-ups. `lateral_raise` is never predicted correctly and is never predicted
at all in the test subject.

## 2. Confusion (test, raw counts)

| true ↓ / pred → | cardio | core_flex | core_iso | hinge | h_push | lat_raise | squat |
|---|---|---|---|---|---|---|---|
| cardio_dynamic | 61 | 3 | 0 | 44 | 20 | 24 | 56 |
| core_flexion | 0 | 46 | 0 | 23 | 0 | 0 | 19 |
| core_isometric | 68 | 0 | 3 | 0 | 16 | 8 | 0 |
| hinge | 4 | 33 | 32 | 174 | 24 | 39 | 32 |
| horizontal_push | 1 | 0 | 0 | 0 | 18 | 0 | 0 |
| lateral_raise | 1 | 0 | 0 | 0 | 0 | 0 | 18 |
| squat | 15 | 0 | 0 | 1 | 6 | 6 | 133 |

Top confusions:

1. `core_isometric` → `cardio_dynamic`, 68 windows (71.6% of the class).
2. `cardio_dynamic` → `squat`, 56 (26.9%).
3. `cardio_dynamic` → `hinge`, 44 (21.2%).
4. `hinge` → `lateral_raise`, 39 (11.5%).

The `core_isometric` collapse is the single largest error source. That class in
the test split comes entirely from subject `5e3a8d78`, whose own accuracy is
0.408 — so the model has not learned a plank-like static pose that transfers to
that person.

## 3. Per-test-subject performance

| Subject | Windows | Videos | Accuracy | Macro-F1 | Classes present |
|---|---|---|---|---|---|
| 04996ace | 66 | 1 | 1.000 | 1.000 | squat |
| 17e2d98f | 152 | 8 | **0.072** | 0.035 | 5 |
| 5e3a8d78 | 341 | 18 | 0.408 | 0.301 | 4 |
| ce0fbe3f | 19 | 1 | 1.000 | 1.000 | core_flexion |
| fcd2886c | 350 | 14 | 0.571 | 0.238 | 2 |

Subject `17e2d98f` scores 0.072 across five classes, and its per-video
accuracies are 0.00 for six of eight clips (e.g. `high knees` 0/19,
`sun rises` 0/19, `cross toe touches` 0/19). This is not label noise: the same
subject's `slow sq` clip scores 0.53. The failure is person-level, not
clip-level — the model has learned that subject's appearance poorly.

The two perfect subjects contribute 85 windows from **one video each** (a single
class), so the 1.000 is not evidence of generalisation either.

## 4. Class imbalance

Window imbalance in train is 51.8× (min 25 `lateral_raise`, max 1,295
`core_flexion`). The class weighting that was applied (up to 18.8× for
`lateral_raise`) is compensating by up-weighting a class that has **one training
subject** — the weights inflate variance, they do not add information.

Subject counts per class (train): `lateral_raise` 1, `squat` 2, `horizontal_push`
3, `core_isometric` 5, `cardio_dynamic` 6, `core_flexion` 12, `hinge` 13.

So imbalance is not only in windows; it is in independent identities, which is
the quantity that determines generalisation.

## 5. Does the window contain movement information? (No.)

Perturbation tests on the held-out windows, same model, same labels:

| Input | Accuracy | Δ vs identity |
|---|---|---|
| identity (real window) | 0.4688 | — |
| **single frame repeated 48×** | **0.4375** | **−0.031** |
| time reversed | 0.4677 | −0.001 |
| mirrored (x negated, joints swapped) | 0.3265 | −0.142 |
| rotated +10° | 0.4256 | −0.043 |
| rotated +20° | 0.3890 | −0.080 |
| rotated −20° | 0.3728 | −0.096 |
| x scaled 1.15 | 0.4601 | −0.009 |
| y scaled 0.85 | 0.4720 | +0.003 |

Two results matter:

- **A single repeated frame loses only 3 points.** The model is classifying
  static pose. Temporal information contributes almost nothing.
- **Time reversal changes nothing** (0.4677 vs 0.4688), which is expected from
  the architecture: `CNN1DClassifier` ends in `AdaptiveAvgPool1d(1)`, so the
  network is order-invariant by construction. It is a bag-of-frames model, not a
  movement model. Any claim that it reads reps or phases is unsupported.

Mirroring costs 14 points, so left/right appearance is being used; the flip
augmentation (p=0.5 per window) did not produce mirror invariance.

Anisotropic scaling barely matters, which is consistent with
torso-normalisation: absolute body proportions are already removed.

## 6. Preprocessing: what it preserves and destroys

The FEATURE_SPEC pipeline (pad → unpad → mid-hip centring → unit-torso scaling
→ 15 fps) removes:

- absolute position in frame (centring) — intended;
- absolute body size (torso scaling) — intended, and confirmed harmless above;
- **global camera roll** — *not* removed. Rotations of the normalised pose cost
  4–10 points, so tilt is still a nuisance variable the model must absorb.
- **facing direction** — not canonicalised (no left/right sign convention),
  which is why mirroring costs 14 points.

Padding/unpadding is clean: zero-filled joint slots are 0.07% of all slots and
only 5 of 928 test windows contain any; dropping windows with <50% detections
removed just 4 windows total. Missing-landmark handling is therefore not a
meaningful error source here.

## 7. Memorisation vs generalisation

Variance decomposition of per-window mean pose (132-dim):

| Grouping | Between-group var/dim | Within-group var/dim | Fisher ratio |
|---|---|---|---|
| by class | 111.49 | 0.99 | 112.5 |
| by subject | 83.26 | 0.64 | **130.5** |
| by subject, class mean removed | 63.98 | 0.62 | 103.9 |

Subject identity separates windows **better** than movement class does, and
removing the class mean leaves a subject Fisher ratio of 103.9. The
representation is dominated by person/camera characteristics, which is exactly
the condition under which a model with 168k parameters memorises training
subjects and collapses on a new person.

Baselines on the same test split:

| Predictor | Accuracy | Macro-F1 |
|---|---|---|
| majority class | 0.095 | — |
| nearest train class centroid | 0.289 | — |
| pattern_v1 | 0.469 | 0.359 |

The CNN beats a trivial centroid baseline by 18 points, so it *is* learning
class structure — but only a fraction of the way to usable.

## 8. Data-integrity defects found

1. **Subject-ID aliasing (leak).** Filenames carry either an 8-char subject hash
   or a full 32-char hash. `cbc15c42` (7 videos) is in **val** and
   `cbc15c42a1594949711ac9a7c8c465e1` (1 video) is in **train** — the same person
   on both sides of the split. `199aec58` and `199aec58ef058b0...` are also the
   same person, both in train (inflates the subject count, 30 vs 28 real).
   Impact on the reported test number is nil (the collision is train/val), but
   val model selection was contaminated by 17 windows.
2. **16 multi-set clips** (`[13-12-14]`) are treated as one long sequence. The
   annotation has per-set rep counts that the window loader ignores.
3. 30 subject IDs are really 28 distinct subjects, so `subjects_per_split`
   overstates coverage.

## 9. Specific causes of 0.469 / 0.36, ranked by evidence

1. **Architecture cannot represent movement.** Global average pooling makes the
   model order-invariant; single-frame input scores 0.4375 vs 0.4688. Not a
   tuning issue — a structural one.
2. **Effective sample size is 5 test subjects, not 928 windows.** Per-subject
   accuracy ranges 0.072–1.000. The headline number is dominated by one person
   (`fcd2886c` + `5e3a8d78` = 691 of 928 windows).
3. **Class coverage is one or two subjects for 3 of 7 classes**
   (`core_isometric`, `horizontal_push`, `lateral_raise`). No method can
   generalise a class from one identity; the 0.046 / 0.349 / 0.000 F1s are
   measurement artefacts of that, not fixable by loss weighting.
4. **Representation is subject-dominated** (Fisher 130 subject vs 112 class, 104
   after class-mean removal). The model exploits identity cues available in
   train.
5. **`core_isometric` → `cardio_dynamic` confusion (71.6%)** is the largest
   single error block; both are core classes that differ mainly in motion, which
   cause #1 makes invisible.
6. **No facing/roll canonicalisation**, so mirror (−0.142) and ±20° roll
   (−0.08/−0.10) degrade accuracy.
7. **Class weights up to 18.8×** applied to a class with a single training
   subject — the weighting increases variance without adding information.
8. Subject-ID aliasing leaks 1 video of a val subject into train (minor, but it
   must be fixed before any new run is compared).

## 10. What this means for the next experiment (not yet run)

Evidence-driven, in order:

- Replace order-invariant pooling with an architecture that keeps temporal
  structure (temporal convolutions + attention/pooling over segments, or a small
  GRU) and **verify it beats the single-frame baseline of 0.4375** before
  trusting any improvement.
- Fix subject canonicalisation (8-char hash) before splitting, and re-derive
  splits so no person appears twice.
- Canonicalise facing direction and roll, or add rotation/mirror augmentation
  that is actually learned (the current flip did not take).
- Report **subject-level** metrics (mean per-subject accuracy, per-subject
  distribution) as the primary number, with window-level only as secondary.
- Do not pursue `curl` / `triceps_extension` / `horizontal_pull` until their
  subject counts genuinely clear the minimum.
- More data from new identities matters more than any architecture change; the
  recording pipeline is the real unblocker.
