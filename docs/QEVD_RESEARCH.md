# Qualcomm motion benchmark: research evaluation

Prepared October 18, 2026. This workflow evaluates the existing fixed counter/identifier. It does not train a model, activate a classifier, add videos to the library, or change Android/web application behavior.

## Source and usage boundary

Source: [Voxel51's Qualcomm benchmark conversion](https://huggingface.co/datasets/Voxel51/qualcomm-exercise-video-dataset-benchmark), pinned revision `0120718af698ba7e2558aa4417bdd916b20080bb`. [Qualcomm describes this split](https://www.qualcomm.com/developer/software/qevd-dataset) as a test benchmark with participants distinct from Fit-Coach. Keep it held out: do not use its frames, extracted landmarks, labels or evaluation results to train, select thresholds or choose a winning model. Freeze a candidate using a separate development dataset before evaluating it here. The current tool measures the existing heuristic baseline only.

The [linked research license](https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/Dataset-Research-License-Feb-25-2025.pdf), sections 1–3, limits data processing and resulting models to internal nonprofit research, restricts redistribution, and defines third-party product/service use broadly, including unpaid offerings. Separate rights would be required before deploying a model derived from these data or displaying the videos to app users. Research provenance is not release clearance. This workflow performs no remote upload or model training.

## Actual annotation audit

The downloaded snapshot contains 74 videos totaling about 194.85 minutes, 2,511 feedback events and 498 transition cues. The conservative numeric/count-message matcher finds 74 count-like cues. Those cues are intermittent coaching feedback, not a verified repetition boundary/count table. The repository's advertised `train` split name does not turn this benchmark into training data.

`scripts/prepare-qevd-benchmark.mjs` validates video IDs/timebases and one-based inclusive frame supports, hashes the source annotations, and generates proposed windows after transition cues. These are **review proposals**, not verified exercise start/end times: cues can precede movement, include session endings and describe unsupported variations. No exercise label, count, side or participant identity is inferred from the text.

All source JSON, video, landmarks, manual annotations and detailed reports stay in ignored `research-data/qevd/`. They are not imported by frontend/mobile/backend builds or exposed through an API. Do not commit or publish that directory. A Git ignore rule prevents accidental ordinary staging; it is not an access-control mechanism.

## Run the workflow

From the repository root, prepare annotations and one explicitly selected video:

```powershell
node scripts/prepare-qevd-benchmark.mjs --video 0006
```

Omit `--video 0006` to download annotations only. Re-running replaces the generated `manifest.proposed.json`, not `manifest.reviewed.json`. The source revision is pinned in the shared research helper; changing it requires checking the license and annotation format again.

Extract local pose frames using Python 3.12 with MediaPipe 0.10.32 and an available OpenCV installation. The project's existing isolated `.venv-pose` environment was used for the smoke check:

```powershell
.\.venv-pose\Scripts\python.exe scripts/extract-qevd-poses.py 0006
Copy-Item research-data/qevd/manifest.proposed.json research-data/qevd/manifest.reviewed.json
```

Do the copy once, before editing; do not overwrite existing reviewed work. Extraction uses the existing lite pose model, CPU, VIDEO mode, confidence thresholds 0.6 and 10 Hz sampling. It records model/video hashes and runtime versions, retains empty detection frames and estimates world landmarks. It verifies the video's frame rate/count against the annotations. Python results are a research proxy: browser/native runtime behavior, Android latency, battery and memory still require device testing.

Review the local video and edit `manifest.reviewed.json` for each segment to score:

- Correct `startMs` and `endMs` to actual movement boundaries, in zero-based milliseconds with an exclusive end. Use complete repetitions and the same start/end convention as the counter. A coaching announcement alone is insufficient.
- Set `reviewer` and an opaque, independently verified `groupId` for the actual participant/session. Do not infer identities from faces. Keep related sessions together; report repeat-subject dependence when comparing results.
- Set `kind` to a supported movement family and `side` to `left` or `right`, chosen before looking at predictions. Set `expectedReps` to a manually checked nonnegative integer.
- Use `kind: null`, `side: null`, `expectedReps: null` for reviewed unsupported movements/rest. For example, a walking/jump lunge is not automatically equivalent to the stationary-lunge preset. These segments measure false acceptance.
- Set `reviewed: true` only after checking these fields. Leave ambiguous clips pending, with notes; obtain an independent second count where possible and resolve disagreements before evaluation.

Do not report multiple partial windows from the same exercise as independent repetitions of the benchmark. Current reviewed segments must be disjoint and ordered per video. Remove proposed end-of-session windows if empty; retain genuine rest/transition windows as reviewed unsupported examples when testing false positives.

Evaluate:

```powershell
node scripts/evaluate-qevd-benchmark.mjs
```

The output is ignored `research-data/qevd/evaluation.json`. It includes counter/identifier versions, source/manifest/engine/model/video hashes, scored/pending counts, missing recordings, evaluated groups, confusion counts, per-family precision/recall, selected-count mean absolute error, exact-count rate and unsupported false accepts. Metrics are segment-weighted, not participant-independent confidence estimates. Automatic recognition and selected-exercise rep accuracy are separate measures; the tool does not evaluate automatic multi-exercise segmentation across an entire session. Do not choose the better side or adjust boundaries after seeing predictions.

Unreviewed examples are never scored. Missing recordings remain explicit. Empty/truncated/gapped pose streams cannot become successful zero counts. With no scored examples, accuracy/error are `null`, not zero. Low-confidence/missing detections within otherwise complete streams remain in the baseline so difficult motion is not silently discarded. Inspect their coverage in the report.

The training CLI now rejects the benchmark's evaluation-only purpose/source marker. Retain provenance on derived data; this guard prevents common mistakes rather than detecting deliberate relabeling. It does not enforce a license or make other datasets release-safe.

## Current verification and remaining work

The real video `0006` decoded and produced **1,625 sampled frames**, including **19 frames with no pose**. Desktop extraction averaged about 11 ms per inference in this environment; this is not an Android performance result. Source and output files were confirmed ignored by Git.

The initial report contains **0 scored segments**, **498 pending review proposals**, and null accuracy/count-error metrics. There is no real-video accuracy claim yet. Ground-truth review, remaining video extraction, suitable separately licensed training/development data, independently held-out evaluation and physical-device testing remain necessary before a learned classifier can be considered for release.

Synthetic tests exercise support conversion, provenance, missing/unreviewed data, real-engine replay, unsupported false accepts, invalid review fields/streams, overlapping windows and training rejection. They verify the tooling, not human motion accuracy.

Verification: all 174 frontend Node checks passed, including nine research-tooling checks; targeted JavaScript lint and Python compilation passed. No application runtime code or dependencies changed, so the earlier browser/build/Android results are not new research accuracy evidence.
