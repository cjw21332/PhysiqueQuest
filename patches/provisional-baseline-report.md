# CURRENT-code replay against provisional visual labels — 2026-11-21

**Review checkpoint. No tracking behavior changed. No result is validated accuracy.**

The browser-free run completed on **7 unique high/medium-confidence clips, 1,921 frames**. Errors below are differences from **PROVISIONAL, UNREVIEWED visual labels**, not established ground truth or measured device accuracy. Ten clips remain unscorable; two additional clips have disagreeing visual passes and are excluded from scoring. This is a partial-coverage baseline, not a baseline for all 19 clips or the exercise catalog.

## Inputs, independence and limits

- Local input folder: `C:\Users\MY PC\Downloads\PhysiqueQuest testing`. No videos or model assets were downloaded. Exact paths, sizes and hashes remain in `patches/local-video-inventory.json`.
- There are 20 filenames and **19 unique SHA-256 contents**. `machine seated dip 2nd try.mp4` is identical to `machine seated dip.mp4`; only the latter was labeled/scored. The duplicate filename is retained in that label's `duplicate_files`.
- Read the November 21 reassessment and current shared engine/configuration before running. Every run records source/model hashes and its exact ffmpeg command. The aggregation script verified those source hashes against the unchanged working tree.
- Visual labels were transcribed before inference, using ffmpeg contact sheets and direct image inspection. Accepted clips have two separately decoded passes offset by half a sample interval. Counts do not come from the model, counter, burned-in displayed totals, or pixel signal. Manifest SHA-256 frozen before inference: `3ca6147633f47d2940883693abcbf153e999d6f89962531cf8131f836d9be4bb`.
- These are **screen recordings**, with opaque counters, alerts and skeleton lines already in the pixels. Visual sheets masked counter regions, colored lines and alert rows where possible; masking was imperfect. It cannot reconstruct anatomy hidden by opaque UI. Some original-size endpoint crops were also inspected. This is independent visual judgment, not a fully blinded multi-rater study.
- Replay uses the local `pose_landmarker_lite.task`, Python MediaPipe Tasks **0.10.14 CPU**, VIDEO mode, three poses, confidence settings 0.6, and ffmpeg **10 Hz** resampling with maximum width 480. The Node bridge imports the CURRENT TypeScript engine, registry, central-subject selector and display filter. It adds read-only diagnostic fields to the in-memory snapshot; it does not replace counting logic.
- **Replay sees the whole original screen recording, including baked-in UI.** It does not receive an original camera-only stream, and it does not reproduce native/browser camera gates, pause/resume controls, React rendering, voice delivery or camera lifecycle. It drives the shared counter continuously. Results therefore characterize this screen-recording/shared-engine proxy, not the complete phone app. No claim about screen-UI effects being present in the live camera input is warranted.
- Name-matched catalog IDs are recorded in the manifest/configuration. The screen recordings do not expose the original selected catalog ID. In particular, the seated-dip footage looks like a feet-supported parallel-bar dip, and the weighted-dip footage does not visibly establish added load. Recorded/name-resolved mappings are preserved, not silently corrected.
- `camera_facing` remains null: hardware front versus back cannot be established independently from these pixels. `camera_view` records the observed body view instead. Plate weights are not inferred from appearance.

## Frozen visual labels and holdout

Each exercise's manifest entry contains its ROM definition. One rep requires **start → far endpoint → return to start**. Clear closed cycles that visibly stop short are partial; hidden or incomplete cycles are ambiguous and excluded from both totals. Static holds, mounting/dismounting and people gesturing are not repetitions. Counts represent movement cycles, not sums of left/right arms.

| Clip | Exercise/attempt | Full / partial | Confidence | Dense visual fps; offsets | Split |
|---|---|---:|---|---|---|
| c01 | Rear pull-up | 4 / 0 | Medium | 6; 0, 0.0833 s | Development |
| c03 | Shoulder press, second | 10 / 0 retained; A=11/0, B=10/0 | Low; not scored | 4; 0, 0.125 s, 40–87 s | Development |
| c04 | Feet-supported parallel-bar dip; filename seated dip | 5 / 0 | Medium | 12; 0, 0.0417 s | TEST |
| c06 | Preacher curl | 1 / 0 | Medium | 6; 0, 0.0833 s | Development |
| c11 | Front pulldown, first | 5 / 0 retained; A=5/0, B=6/0 | Low; not scored | 6; 0, 0.0833 s, 16–48 s | Development |
| c12 | Front pulldown, second | 1 / 0 | Medium | 6; 0, 0.0833 s | TEST |
| c14 | Chest press, third | 7 / 0 | High | 12; 0, 0.0417 s | TEST |
| c15 | Parallel-bar dips; filename weighted dips | 5 / 1 | Medium | 12; 0, 0.0417 s; 3–9, 25–49, 57–75 s | Development |
| c17 | Bench press, first | 5 / 0 | Medium | 12; 0, 0.0417 s; also rotated/cropped for viewing | Development |

Outside the stated dense windows for c03/c11/c15, only coarse triage of setup/black-camera sections was performed. This limitation is retained in the labels. c03 and c11 are low confidence; c15 is medium, not high. No accepted visually counted cycle is faster than half its dense sampling rate. Hidden intervals and excluded clips have unknown aliasing risk. A coarse 1 Hz sheet is never presented as a rep count.

The four TEST clips were designated before inference/tuning: **c04, c12, c14, c19**. c04 is the clear slow dip case; c19 is the plate-occluded bench case. **c19 remains held out but cannot be scored** because plate/UI occlusion prevents an independent whole-clip ROM label. No test clip was used for tuning; there has been no tuning. Holdout coverage does not establish occlusion robustness.

The independent pixel cross-check uses hand/handle-region frame differences and pairs motion bursts. It is intentionally simple and unsuitable for ROM labeling. Its comparisons versus visual complete-cycle totals are c01 **6 vs 4**, c04 **11 vs 5**, c06 **12 vs 1**, c12 **9 vs 1**, c14 **11 vs 7**, c15 **40 vs 6**, c17 **7 vs 5**. All disagree. Moving cameras, UI changes, incomplete endpoints and holds confound the signal. **It was not used to alter any label.** The script, raw signal CSVs and peak times are preserved.

## Baseline table

Error = replay count − provisional visual count. Missing = frames where **neither** configured shoulder–elbow–wrist triplet can produce a usable angle. One usable arm is enough for this metric. A second table distinguishes losing either arm. Numbers cover the entire screen recording, including black/setup sections.

### High confidence — TEST

| Clip/exercise | Visual full/partial → replay | Full error | Partial error | Missing working triplet | p95 inference, ms | p95 by first / middle / last third, ms |
|---|---|---:|---:|---:|---:|---|
| c14 Chest press, third | 7/0 → 7/3 | 0 | +3 | 15/243 (6.2%) | 50.99 | 52.51 / 55.85 / 44.23 |

### Medium confidence — TEST

| Clip/exercise | Visual full/partial → replay | Full error | Partial error | Missing working triplet | p95 inference, ms | p95 by first / middle / last third, ms |
|---|---|---:|---:|---:|---:|---|
| c04 Feet-supported dip | 5/0 → 4/3 | −1 | +3 | 12/214 (5.6%) | 59.40 | 63.62 / 56.35 / 58.21 |
| c12 Front pulldown, second | 1/0 → 1/1 | 0 | +1 | 94/131 (71.8%) | 59.72 | 59.93 / 60.27 / 33.86 |

### Medium confidence — development

| Clip/exercise | Visual full/partial → replay | Full error | Partial error | Missing working triplet | p95 inference, ms | p95 by first / middle / last third, ms |
|---|---|---:|---:|---:|---:|---|
| c01 Rear pull-up | 4/0 → 4/1 | 0 | +1 | 5/183 (2.7%) | 73.34 | 65.64 / 66.25 / 77.95 |
| c06 Preacher curl | 1/0 → 3/4 | +2 | +4 | 84/216 (38.9%) | 60.45 | 52.20 / 64.33 / 61.21 |
| c15 Parallel-bar dips | 5/1 → 5/4 | 0 | +3 | 296/777 (38.1%) | 63.52 | 66.14 / 56.03 / 73.69 |
| c17 Bench press, first | 5/0 → 5/3 | 0 | +3 | 53/157 (33.8%) | 64.97 | 68.28 / 65.90 / 44.23 |

No high-confidence development clips exist. All count errors remain relative to provisional labels. Summed full counts are 29 versus 28, but absolute full-count errors sum to 3: aggregation hides the dip/curl cancellation. Partial counts are 19 versus 1. **Zero of seven clips has exact totals in both categories.** This small, selectively scorable subset cannot estimate catalog-wide accuracy or reliable partial-rep recall; only one provisional partial cycle is represented.

### Missing joints and form cues

| Clip | At least one arm incomplete / frames | Emitted form-cue events | Provisional false-cue fraction | False events/minute |
|---|---:|---:|---|---|
| c01 | 9/183 | 1 | 1/1 adjudicated false (100%) | 3.28 |
| c04 | 140/214 | 0 | N/A, zero emitted events | 0 observed |
| c06 | 90/216 | 0 | N/A, zero emitted events | 0 observed |
| c12 | 106/131 | 2 | **Unmeasured**: both unassessable | Unmeasured |
| c14 | 29/243 | 0 | N/A, zero emitted events | 0 observed |
| c15 | 702/777 | 0 | N/A, zero emitted events | 0 observed |
| c17 | 103/157 | 0 | N/A, zero emitted events | 0 observed |

c01 was reviewed directly at 5.6/5.9/6.2/6.5/6.8 s: the real torso remains upright; the replay's collapsed shoulder-to-hip geometry does not correspond to a visible torso swing. This is a provisional cue adjudication, not a safety/form certification. c12 has moving oblique camera geometry and covered hips at 5.2/6.0 s; those events are unknown, not automatically false or true. There is no honest combined false-cue rate with those two events unadjudicated. Zero emissions do not prove form assessment works. **Occluded-bench false-cue rate is unmeasured.**

`baseline-latency-windows.json` contains 5-second p50/p90/p95/p99/max windows, counts and usable-triplet-only p95. Blank-camera tails explain some falling latency. c01 rises from 65.64 to 77.95 ms and c15 from 66.14 to 73.69 ms across thirds, but these short clips, changing content and new model instances cannot establish progressive lag, a leak or thermal throttling. Timings cover model inference only, excluding decode, bridge calls and rendering.

## Three strongest observed failure mechanisms

Frame numbers below are **zero-based 10 Hz replay frames**, not source-video frame indices; approximate source index is frame × 3 for these 30 fps recordings. Event traces preserve exact replay timestamps. These are supported findings in this proxy. Their contributions to live-phone failures still require camera-only replay and controlled follow-up.

1. **High visibility does not ensure correct anatomical geometry, and bilateral selection can stay on the wrong limb.** At c01 frame **62** (6.201 s), replay left shoulder is `(0.436,0.391)` and hip `(0.528,0.399)`, both visibility **1.000**. That near-zero torso height drives a `torso_swing` cue despite the independently visible upright torso. At c04 frame **174** (17.401 s), left/right elbow angles disagree **85.84° versus 178.29°**, while elbow/wrist visibilities are **0.885/0.871 versus 0.962/0.930**. The selected side remains right and emits a partial. `sideScore` ranks confidence; a locked side only accepts an agreeing opposite-side angle within 25°. It has no proof that the higher-confidence angle describes the actual limb. Screen UI and equipment are input confounders here; the trace does not isolate which caused the landmark errors.

2. **Stationary/held motion and shared-handle movement become extra cycles, amplified by per-side mode.** In c06, frames **63, 102, 124** (6.301, 10.201, 12.401 s) emit partials while direct visual sheets show extended-arm waiting, before the first curl starts around 13.5 s. Left elbow/wrist visibilities are **0.976/0.956**, **0.932/0.899**, **0.957/0.937**: these are not simply absent joints. Frames **151 and 155** emit full events during the visually flexed hold, with left angles jumping **133.75° → 159.18°**; left wrist visibility **0.704 → 0.673**, and right wrist falls **0.856 → 0.270**. Current preacher config inherits `curl` **per_side**, summing independently running arm states even though the visible exercise uses a shared handle. Actual replay result is **3 full/4 partial versus 1/0**. The data supports both erroneous geometry during holds and an inappropriate counting-unit candidate; an ablation is required to quantify their separate effects. c01 frame **16** also emits a partial from the initial incomplete descent, illustrating the need to distinguish a cut-in half-cycle from a completed shallow cycle.

3. **A credible central person is not necessarily the person currently performing the selected exercise.** In c15 frame **99** (9.901 s), the white-shirt participant is standing and gesturing after dismounting, yet a full event fires. Elbow/wrist visibility is **0.930/0.974 left**, **0.976/0.986 right**. Frames **233/234/243** emit partials around an empty foreground apparatus/camera pan; frame 233 elbow/wrist visibilities are **0.795/0.819 left**, **0.603/0.620 right**. Separately, the name-resolved `Weighted Triceps Dips` catalog entry is **triceps_extension, per_side**, whereas the actual footage shows parallel-bar dips. A different catalog entry, `weighted triceps dip on high parallel bars`, maps to `dip`. This is a concrete mapping discrepancy and an activity/subject-continuity problem visible in replay; no fix or causal ablation has been applied. The offline driver omits the app's start gate, so these events cannot be asserted to have reached a real app session identically. The matching total of five full events hides at least the standing/gesturing event; it is not evidence all five observed dips were counted correctly.

## Excluded coverage and spot checks

The manifest has all **19 unique entries**. Unknown totals are null, not invented zeros. Only counted clips have two-pass counts; excluded clips explicitly say triage-only. In excluded footage, check times identify blocked/setup intervals, not three fictional reps. Where fewer than three complete reps exist, the spot-check sheet provides uncertain endpoints and interruption times.

| Clip | Filename/attempt | Reason not scored | Three check times, s |
|---|---|---|---|
| c02 | Shoulder press, first | Setup/countdown, cropped overhead endpoints; dense count not established | 6, 38, 64 |
| c03 | Shoulder press, second | Pass counts disagree on short cycle at 69.5 s | 69.5, 77.5, 86.5 |
| c05 | Reverse T-bar row | Rotated image and persistent banner hide working arm/torso | 4, 12, 18 |
| c07 | Narrow-grip row, first | Black-camera intervals plus banner covering arms | 6.5, 11, 17 |
| c08 | Narrow-grip row, second | Black-camera intervals plus hidden working endpoints | 2, 5.5, 7 |
| c09 | Incline chest press, first | Persistent banner hides shoulders/arms; camera then moves away | 2, 8, 14 |
| c10 | Incline chest press, second | Persistent banner hides working endpoints | 3, 15, 22 |
| c11 | Front pulldown, first | Pass counts disagree across banner/bystander interval | 23.8, 28.7, 47.7 |
| c13 | Chest press, first | Intermittent banner; defensible whole-clip ROM count not established | 4, 10, 15 |
| c16 | Chest press, second | Repeated banner, camera move/countdown; whole-clip ROM unresolved | 4, 13, 20 |
| c18 | Bench press, second | Plate plus banner hides working ROM | 2, 7, 11 |
| c19 TEST | Bench press, third | Plate plus banner; retained as holdout, not independently scorable | 9, 16, 27 |

c02/c13/c16 need further dense independent review or camera-only source footage; their exclusions must not be interpreted as proof that the entire underlying recording is intrinsically unusable. c19's occlusion boundaries in the manifest are coarse visual intervals, not precise frame annotations. Additional unaugmented camera footage is required before claiming a plate-occlusion baseline or an improvement. These exclusions bias coverage toward clearer views; keep that limitation in every comparison.

## Acceptance criteria — keep the first report's thresholds

These targets were already proposed in `docs/pose-replay/first-report.md`; this report does **not** relax them in response to failures.

| Metric | Frozen target | Evidence in this pass |
|---|---|---|
| Full and partial counts | ≤1 absolute error in either category in every set; ≥95% of sets exact in both | Proxy misses target: c06 full +2; five clips have partial error >1; 0/7 exact in both. Provisional references only. |
| Event correspondence | One-to-one review within 300 ms of annotated cycle completion; unmatched events separate | Not comprehensively scored. Visual timestamps are approximate and engine/label cycle-start phases differ. No fabricated timing precision. |
| False cues | ≤0.1 false events/min of fully adjudicated footage; zero confident faults from unreliable/fully hidden working geometry | c01 provisional adjudication misses rate target (3.28/min); c12 unknown; plate clips unmeasured. |
| Phone latency | p95 inference ≤100 ms; capture-to-overlay ≤150 ms after warmup | Phone unmeasured. Desktop proxy p95 50.99–73.34 ms is not a phone pass. |
| Dropped inference opportunities | ≤10% at declared target rate, separating deliberate decimation and stale/decoder drops | Unmeasured. Resampling 30→10 Hz is deliberate decimation, not measured live dropped frames. |
| Camera restarts | 0 uncommanded / 30 min; commanded switches separate | Unmeasured; no live camera used. |
| Memory trend | After 5-min warmup, ≤20 MiB net growth and ≤0.5 MiB/min fitted growth through minute 30, by memory domain | Unmeasured; no 30-minute soak. |

Each promotion still needs at least three independently labeled sets and the requested camera facings, full/partial mix and relevant occlusion/views. The present clips meet no exercise-level promotion requirement. Catalog classifications remain **835 partially supported / 127 not yet validated / 538 unsupported / 0 validated**.

The soak plan retains actual available temperature sensor identity or native thermal-state transitions, one-minute p50/p90/p95/p99/max latency trends, domain-specific memory, scheduled/processed/stale/dropped frames and commanded/uncommanded restarts. Pull-ups require a near-full hang and contracted top in the same visible cycle; dips require extended elbows at the **top**, sufficient depth at the bottom, and return. No straight-elbow-at-dip-bottom rule is introduced.

## Reproduction, artifacts and remaining boundary

Run from this repository using the payload tools without applying runtime patches:

```powershell
rtk proxy python patches/files/scripts/pose-replay/run-provisional-baseline.py
rtk proxy python patches/files/scripts/pose-replay/summarize-provisional-baseline.py
rtk proxy python patches/files/scripts/pose-replay/pixel-crosscheck.py
```

The first command refuses to overwrite completed runs. To reproduce, pass `--output output/pose-replay-private/provisional-baseline-rerun` to use a fresh directory. The summarizer currently reads the named November 21 run; change its input path explicitly when comparing another run. Exact per-clip commands are in `output/pose-replay-private/provisional-baseline-2026-11-21/cNN-command.json`; each folder includes raw per-frame landmarks/visibility, selected side, rep events, cues, inference latency, configuration and provenance. That directory is private/generated output, not an app modification.

Review `patches/labels.local.json`, `visual-spot-checks.md`, `provisional-baseline.json`, `baseline-table.csv`, `baseline-event-evidence.json`, and `baseline-latency-windows.json`. The replay log records one pre-inference environment/tooling failure: Windows CRLF bytes disagreed with the LF manifest hash. Writing the same manifest content as UTF-8 LF resolved it before any model frame ran; no labels or tracker behavior changed. Previous headless-browser startup errors remain in the earlier report; this run required no browser.

No tests were changed. Previous reconciliation remains **81 = 56 focused engine/mobile + 25 camera/registry/scheduling**, not 81 engine tests. The earlier four application commands executed 106 tests (101 pass, 5 fail); four harness tests were separate. Exact commands and the four generic-counter failures plus upload-flow failure are recorded in the first report. These suites were not rerun or claimed newly passing in this labeling-only pass.

All new tooling/report changes are supplied as patches; `.git` was not written. Do not apply earlier reference-overlay candidates 0005/0006 as part of baseline review. No APK, deployment, leak fix, camera fix or tracking fix was produced. **Stop here for review before Step 2.**
