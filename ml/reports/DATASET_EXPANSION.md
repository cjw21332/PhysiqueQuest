# Dataset expansion assessment (Phase 4)

Scope: can any additional public dataset legally and technically extend the
seven trained classes? Verified against the source page on 2026-11-16; licence
statements are quoted, not inferred.

## Candidates checked

| Dataset | Content relevant to our classes | Subjects | Licence (as published) | Trainable for shipped weights? |
|---|---|---|---|---|
| **PushUpBench** (in use) | 231 clips, 9 push-up-side patterns, rep annotations | 28 distinct | **CC-BY-4.0**, training and redistribution permitted with attribution | **Yes** |
| REHAB24-6 (Zenodo, 2024) | 65 recordings; squats, table push-ups, arm abduction (lateral raise), lunge; rep segmentation + correctness labels; two camera views | 10 | "academic or non-profit organization noncommercial research use only … For comercial purposes contact us" | **No** (non-commercial) |
| FLEX (2025) | 7,512 trials, 20 weight-loaded actions incl. squat/hinge/lateral raise; 5 views; 38 subjects | 38 | "CC BY-NC 4.0" and a signed licence agreement restricting to non-commercial academic research | **No** (NC) |
| Fitness-AQA (ECCV 2022) | Squat, push-up, row, overhead press; form labels | ~5–10 | "Only available for non-commercial purposes" | **No** (NC) |
| M3GYM (CVPR 2025) | 82 gym sessions, 500+ actions, 50+ subjects, 8 views | 50+ | Access application; paper does not grant redistribution | **No / unverified** |
| QEVD (Qualcomm) | 289k clips, 148 exercises incl. mistakes | many | Qualcomm product licence agreement, not an open data licence | **No / restrictive** |
| UI-PRMD | 10 subjects, 10 rehab movements, Kinect + Vicon | 10 | Publicly downloadable for research; no explicit commercial grant found | **No / unverified** |
| RepCount-A (on disk) | 1,457 clips, rep counts | many | DATA_LICENSES: evaluation only, no shipped weights | **No** (evaluation only) |

## Conclusion

**No new training-legal dataset was found.** Every multi-subject fitness dataset
with the classes we need is released under a non-commercial or
agreement-gated licence. Training shipped PhysiqueQuest weights on them would
break their terms, so they stay out — the same conclusion as for RepCount-A.

That leaves exactly one compliant source of new identities: the PhysiqueQuest
contribution pipeline built in Phase 3.

## What would change this

- A dataset released under CC-BY-4.0 / CC0 / Apache-2.0 with ≥8 subjects per
  target class. None found in this review.
- Written commercial permission from REHAB24-6 (`info@visioncraft.ai`) or FLEX
  authors. Not requested here; that is a business decision.
- PhysiqueQuest's own recordings, which we control.

## Requirements if a dataset is later added

1. **Licence first**: record the grant in `ml/DATA_LICENSES.md` before download,
   including whether redistribution of derived weights is allowed.
2. **Separate extraction profile**: run `71_extract_videos.py` with its own
   `--videos/--out`; never mix npz files from different extraction settings in
   one directory.
3. **Normalisation parity**: only datasets where MediaPipe can be run on the raw
   video (or that ship 2D joints convertible to COCO-33) are compatible. REHAB24-6
   ships 26 joints and M3GYM ships its own keypoints — both need a documented
   mapping, not an implicit one.
4. **Subject-disjoint splits across sources**: subject IDs must be namespaced
   (`<dataset>:<subject>`) so a person cannot appear in two sources.
5. **Grouped cross-validation**: with ≥8 subjects per class, use
   subject-grouped k-fold for model selection and keep one untouched test fold.
6. **Report per-source metrics**: a model that improves only on the added source
   has not improved for PhysiqueQuest users.
