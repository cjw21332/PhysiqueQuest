# Evidence-first pose replay

This harness imports the current browser worker, MediaPipe model, subject selector, shared counter, exercise registry, frame-interval policy and display filter. It does not copy counting logic. The server injects read-only counter state into `snapshot()` to record the selected side and side states; it does not change transitions or the source file on disk.

## Run

From the repository root:

```powershell
rtk proxy node scripts/pose-replay/run.mjs --snapshot-only --output output/pose-replay-private/source-before
rtk proxy node scripts/pose-replay/run.mjs --check --output output/pose-replay-private/model-check
rtk proxy node scripts/pose-replay/run.mjs --manifest docs/pose-replay/labels.completed.json --videos 'C:\path\to\videos' --output output/pose-replay-private/before
rtk proxy node scripts/pose-replay/run.mjs --manifest docs/pose-replay/labels.completed.json --videos 'C:\path\to\videos' --clip clip-18 --output output/pose-replay-private/bench-before
rtk proxy node scripts/pose-replay/run.mjs --manifest docs/pose-replay/labels.completed.json --videos 'C:\path\to\videos' --soak-minutes 30 --output output/pose-replay-private/soak-before
rtk proxy node --test scripts/pose-replay/replay.test.mjs
```

An installed Chromium/Chrome/Edge with MP4 support is required. Set `--browser` to its executable if discovery fails. All inputs and the model are served on loopback; no external inference service is used. Fresh output directories are mandatory: an existing provenance record cannot be overwritten.

`--check` loads the actual model but processes no video. It is infrastructure verification, not accuracy evidence. `--snapshot-only` captures SHA-256 hashes and exact source/model copies without inference. A dirty git HEAD is insufficient to identify the baseline; use the source fingerprint and per-file hashes. Raw recordings, frame traces and runtime source snapshots are ignored by git.

## Label the recordings

Copy `docs/pose-replay/labels.template.json` to `labels.completed.json`. Keep clip IDs and filenames unchanged. For each clip, provide:

1. `exerciseId`: choose the exact exercise shown in the app. Candidate IDs are suggestions from filenames, not assignments. Confirm `mappingConfirmed`. Verify whether the narrow-grip row alternates sides, whether the reverse T-bar variation is the intended T-bar exercise, and whether the rear pull-up is assisted. Machine seated dip and seated triceps pushdown are distinct; do not relabel them as equivalent.
2. `camera.facing`: `front`, `back`, or `unknown`; `previewMirrored`: true/false/unknown; `view`: front/side/oblique/unknown. Approximate yaw is optional; unknown is acceptable and must not be guessed.
3. `labels.repUnit`: bilateral cycles, individual arm cycles, or alternating left+right pairs. Confirm what one displayed rep should mean.
4. Each set's `startMs`, `endMs`, `fullReps`, `partialReps`. Time is measured from the beginning of the original video, in milliseconds. A zero count must be an observed zero, not a replacement for unknown.
5. `sets[].repEvents`: one `{ "type": "full" | "partial", "startMs": ..., "endMs": ..., "side": "left" | "right" | "bilateral" }` per observed cycle. Include the rule you used to distinguish full from partial in `notes`. Mark ambiguous or entirely hidden cycles as uncertain in notes rather than assigning a confident count.
6. `occlusionIntervals`: `{ "startMs": ..., "endMs": ..., "joints": [11,13,15], "cause": "plate" }`, or `[]` if reviewed and none. Landmark IDs follow MediaPipe Pose; left/right refer to the person's body, not the screen. Specify visibility of the far limb as well.
7. `subjectIntervals`: describe the intended person, entry/exit/crossing times and whether their torso is visible. Use `[]` only after reviewing for bystanders.
8. `formIntervals`: for every rule that emits a cue, provide `{ "rule": "body_line", "startMs": ..., "endMs": ..., "faultPresent": false }` or true where a qualified reviewer can establish it. Missing or ambiguous intervals remain unscored. Set `cueCoverageComplete` only when every emitted cue can be adjudicated. A rep count alone cannot establish a false-cue rate.
9. Set `reviewedBy` and change `reviewStatus` to `reviewed` after review. Null fields remain unknown.

## Outputs and limits

Each run writes provenance (source/model hashes, browser version and dirty git status), exact source snapshots, one streaming JSONL frame trace per clip and JSON summaries. Frame traces contain raw landmarks and visibility/presence, smoothed display coordinates, selected bilateral side, per-side states, angles, full/partial events, cues and worker/inference/drawing timing. Raw coordinates feed the counter. No joint extrapolation is added by the harness.

Offline replay seeks at 10 Hz and processes one frame at a time. It preserves target samples and cannot measure live dropped frames. The optional wall-clock soak uses the app's 50 ms polling, adaptive interval, 480px input cap and one frame in flight. It drops stale scheduling opportunities instead of queueing them and streams traces out of the page. It runs each selected clip for the specified duration, so `--soak-minutes 30 --clip ...` is one 30-minute run; multiple selected clips take 30 minutes each. It is not yet an automated multi-exercise React/camera lifecycle soak.

Browser JS-heap samples and post-warmup slope are reported. They exclude native/WASM allocations and camera driver memory. Timing includes tracing overhead; browser replay is not a phone measurement. Camera restarts, source-frame drop rate, native camera-to-overlay latency and native spoken-cue accuracy stay null because no physical camera or native UI is involved. Do not turn null into zero or label a passed model startup as a passed soak.

To diagnose camera crashes, collect on-device logs with exercise ID, permission result, model init/dispose, lifecycle, track mute/unmute/ended, generation, facing, thermal state and error events. A prerecorded video cannot reproduce permission or camera-driver failures.

The 2026-11-21 environment could discover upload metadata, but video transfer failed with DNS; the headless browser also exited during launch. No recording replay or soak result exists from that environment. Pure report/server unit checks are separate from real-video evidence.
