# Browser-free local replay

The Python entry point decodes original local recordings through an existing ffmpeg binary, loads the app's `frontend/public/pose/pose_landmarker_lite.task` using MediaPipe Tasks VIDEO/CPU, and sends raw per-person landmark arrays over stdin to the current TypeScript engine. The Node bridge imports the current exercise registry, subject selector, counter and display filter. No repetition logic is copied or changed.

Python MediaPipe 0.10.14 and the app browser's `@mediapipe/tasks-vision` 0.10.32 use different runtime backends. This route uses identical model bytes and current counter code; it is NOT proof of identical browser/native detector output or phone performance. No camera/native startup gate/React lifecycle is exercised.

Run from the repository root after applying the patch series:

```powershell
python scripts/pose-replay/offline-python.py --manifest docs/pose-replay/labels.local.json --file-match "barbell bench press.mp4" --exercise-id EIeI8Vf --bridge scripts/pose-replay/counter-bridge.cjs --smoke --output output/pose-replay-private/bench-smoke-new
```

The smoke processes three real frames and is explicitly unscored. Use a fresh output directory. To replay a labeled complete clip, remove `--smoke` after filling the manifest's reviewed `full_reps` and `partial_reps`. Supply the exact selected app/catalog ID in `--exercise-id`; names may be duplicated. `EIeI8Vf` is the catalog's barbell bench press ID and was used only as a filename-based candidate for the infrastructure probe, not as a confirmed label.

The requested simple manifest contains `file`, `exercise_guess`, `camera_facing`, `plate_occluded`, `full_reps`, `partial_reps`, and `notes`. `file` points to verified local bytes; only `exercise_guess` is inferred from the filename. Unknown fields are null. Confirm guesses and fill labels yourself before scoring. Specify the counting unit (individual arms versus bilateral/alternating pairs), set boundaries and ambiguity in notes.

Full and partial error are detected minus reviewed expected totals, scored separately. False form cue rate remains null until independent rule/time correctness annotations are available. A binary `plate_occluded` flag alone cannot adjudicate a cue; record occlusion/cue times in notes or provide a separate timed annotation file. Do not treat absent annotations as “form correct.”

The tool samples at 10 Hz and caps input width at 480 pixels. That is offline sampling, not a live dropped-frame result. It records raw visibility/presence, selected side and side state, smoothed display coordinates, full/partial events, emitted fault appearances and per-frame Python CPU inference latency in `frames.jsonl`. Source and model hashes identify the exact current code. Summary fields for camera restarts, thermal state, memory growth and false-cue rate stay null when unavailable.

On 2026-11-21, the fallback processed three actual bench-press frames successfully. The initial `imageio_ffmpeg` wrapper import failed with `ModuleNotFoundError: No module named 'pkg_resources'`; its already-installed ffmpeg executable worked when invoked directly. Nothing was downloaded or installed. The headless Edge software-GL attempt failed; see the environment log for the full error and flags.

This is replay infrastructure, not a counter fix, validated exercise or rebuilt APK. Stop for baseline review before changing tracking behavior.
