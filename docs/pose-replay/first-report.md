# Pose replay first report — 2026-11-21

## Decision

**Blocked at Step 1. No recordings have been replayed, no tracking behavior has been changed in this pass, and no exercise has been promoted to validated.** This is a baseline preflight and evidence inventory, not a completed before/after accuracy report.

Read `docs/pose-tracker-reassessment.md` first, then inspected the current worker, shared counter/configuration, subject selector, filter, browser hook, native camera callbacks, native session gate/cue flow and registry. Captured the actual dirty source and model before attempting replay. Git HEAD alone does not represent the current working tree.

The baseline snapshot fingerprint is `11daa07e951decfd27e0b060e9c221ee5319bad331cea8abb1fb5017d52c5dbb`. Exact source/model copies and individual SHA-256 hashes are in `output/pose-replay-private/current-source-snapshot/`. This identifies a **source baseline**, not a measured replay baseline.

## Evidence available and blockers

- Located metadata for 20 uploaded MP4 files. Filenames suggest 10 priority exercises plus two clips of Machine Seated Dip, a separate exercise. Exact catalog IDs and variations remain unconfirmed. Duplicate catalog names exist, including narrow-grip row, machine chest press and machine shoulder press.
- No reviewed full/partial rep labels, timestamps, camera facing, occlusion annotations or form-correctness annotations were located. The generated JSON template keeps every unknown label null; it includes candidate catalog IDs but selects none.
- Attempt to download the resolved videos failed: `library download request failed: hosted apps tools/list request failed: DNS`. Metadata availability did not produce locally decodable video bytes. No clips were opened or assessed visually.
- Attempted real model startup using the harness. Edge exited during headless launch: `browserType.launch: Target page, context or browser has been closed`, with `TransactNamedPipe: The pipe has been ended (0x6D)`. Zero video frames were processed. Do not infer an app camera crash from this desktop automation failure.
- The environment also denied a loopback test connection (`connect EACCES 127.0.0.1`). Server routing and HTTP range behavior were tested by direct request dispatch instead; this does not establish browser/runtime execution.
- `git add` failed because `.git/index.lock` could not be created (`Permission denied`). No commits were created. Existing user changes were not staged or overwritten.

The user explicitly requested stopping when labels or device evidence are needed. Therefore no threshold, mapping, camera or counter fix was attempted after the source baseline. The four known counter failures and upload assertion remain visible.

## Proposed acceptance criteria, frozen for subsequent comparisons

These are targets, not achieved measurements. Hold them constant when comparing baseline and candidate runs. Record exact hardware, browser/app build, input resolution, inference backend, camera facing and sampling policy with every result.

| Metric | Acceptance target | Current result |
| --- | --- | --- |
| Full and partial count error | At most 1 absolute error in either category in every labeled set; at least 95% of sets exact in both categories | Not measured |
| Misses / double counts | One-to-one event review within 300 ms of annotated cycle completion; report unmatched events separately so cancellation cannot hide errors | Not measured |
| False form cues | At most 0.1 false cue events/minute of fully adjudicated footage; zero confident form faults during low-confidence/fully occluded working geometry | Not measured |
| p95 latency | At most 100 ms inference and 150 ms capture-to-overlay on the target phone after warmup; separately report desktop replay timing | Not measured |
| Dropped frames | At most 10% of scheduled inference opportunities at the declared target rate; separately report deliberate source decimation, decoder drops and stale candidates | Not measured |
| Camera restarts | Zero uncommanded restarts / 30-minute device session; commanded facing switches reported separately | Not measured |
| Memory | After a 5-minute warmup, at most 20 MiB net growth and at most 0.5 MiB/min fitted growth over the remaining 25 minutes; evaluate JS, WASM and native/process memory separately | Not measured |

Validation scope must be narrow: a passing clip is evidence for that clip/view/device, not for every related exercise. Before promoting an exercise, require at least three independently labeled sets, both requested camera facings, a full/partial mix and relevant occlusion/view conditions. Small sample size and absent conditions remain explicit limitations. No catalog promotion is automated by this harness.

## Before/after measurements

| Measurement | Current-code baseline | Candidate after fix |
| --- | --- | --- |
| Decoded exercise videos / processed frames | 0 / 0 | No candidate fix |
| Count error per exercise | null — reviewed counts and replay unavailable | null |
| False cue rate, including occluded bench clips | null — form adjudication and replay unavailable | null |
| Missing working-joint frames | null — inference unavailable | null |
| Per-frame inference / p95 latency | null — inference unavailable | null |
| Memory trend, stale frames, camera restarts | null — no soak or physical camera run | null |

Null is not zero, and no threshold has been shown to pass. A 30-minute browser replay soak command exists but has not run. It is not yet a multi-exercise React/native-camera soak and cannot measure permissions, native camera restarts, driver memory or on-device thermal effects.

## Priority exercise status

Joint shorthand: **A** = left shoulder–elbow–wrist `[11,13,15]` or right `[12,14,16]`; **L** = hip–knee–ankle `[23,25,27]` or `[24,26,28]`; **C** = knee–ankle–foot index `[25,27,31]` or `[26,28,32]`; **F** = elbow–shoulder–opposite shoulder `[13,11,12]` or `[14,12,11]`; **H** = opposite hip–hip–knee `[24,23,25]` or `[23,24,26]`. One complete configured triplet is required by the current native gate, with its existing confidence, image-boundary and dwell checks. Cues may require additional joints.

Views below are **current configuration recommendations**, not experimentally acceptable angle ranges. All acceptable yaw/pitch ranges are unestablished. “Reported” reproduces the user's observation; it is not measured baseline performance. All after statuses are unchanged/blocked, and every count-error before/after is N/M (not measured).

| Exercise | Current pattern/family | Joints | Configured view; acceptable angles | Reported before | After this pass | Count error before / after |
| --- | --- | --- | --- | --- | --- | --- |
| Barbell Bench Press | horizontal_push | A | Side; unestablished | Plate occlusion and alert spam | No fix; clips 18–20 need replay | N/M / N/M |
| Assisted Pull-up | vertical_pull | A | Front; unestablished | Needs assessment | No matching clip located | N/M / N/M |
| Rear Pull-up | vertical_pull | A | Front; unestablished | Needs assessment | No fix; clip 01 candidate | N/M / N/M |
| Machine Chest Press | horizontal_push | A | Side; unestablished | Needs assessment | No fix; clips 14,15,17 | N/M / N/M |
| Machine Incline Chest Press | horizontal_push | A | Side; unestablished | Needs assessment | No fix; clips 10,11 | N/M / N/M |
| Seated Triceps Pushdown | Exact ID unconfirmed; extension candidates | A if triceps_extension | Side for extension; unestablished | Needs assessment | No matching clip; seated dips are distinct | N/M / N/M |
| Machine Alternating Narrow Grip Seated Row | horizontal_pull; exact ID/mode unconfirmed | A | Front; unestablished | Not fully working | No fix; clips 08,09 need alternating/unit confirmation | N/M / N/M |
| Machine Front Pulldown | vertical_pull | A | Front; unestablished | Needs assessment | No fix; clips 12,13 | N/M / N/M |
| Machine T-Bar Row | horizontal_pull | A | Front; unestablished | Partial detection | No fix; clip 06 says reverse T-bar; confirm variation | N/M / N/M |
| Machine Seated Fly | chest_fly | F | Front; cue says front-oblique; unestablished | No camera access | No matching clip or camera lifecycle logs | N/M / N/M |
| Machine Shoulder Press | vertical_push | A | Front; unestablished | Works, needs angle tolerance | No fix; clips 02,03 | N/M / N/M |
| Triceps Dips | Weighted Triceps Dips maps to triceps_extension; Machine Seated Dip maps to dip | A | Side; unestablished | Not working | No fix; clip 16; mapping discrepancy flagged | N/M / N/M |
| Barbell Squat | squat | L | Side; unestablished | Needs assessment | No matching clip located | N/M / N/M |
| Barbell Standing Bradford Press | vertical_push shared with ordinary shoulder press | A | Front; unestablished | Must stay a distinct movement | Distinct catalog ID remains; no distinct cycle implemented in this pass | N/M / N/M |
| Leg Press | squat | L | Side; unestablished | Partial detection | No matching clip; machine geometry requires replay | N/M / N/M |
| Machine Standing Calf Raises | calf_raise | C | Side; unestablished | Needs assessment | No matching clip located | N/M / N/M |
| Machine Hip Abduction | hip_abduction | H | Front; unestablished | No camera access | No matching clip or camera lifecycle logs | N/M / N/M |

## Source findings versus proven root causes

**No root cause of progressive lag or a physical camera crash has been established in this pass.** No memory profile, device lifecycle trace or clip inference trace exists. Source inspection identifies what to instrument, not proof of a leak:

- The browser hook has one `busy` guard and a worker `finally` that closes the received bitmap. Effect cleanup clears the interval, startup deadline and battery listeners and terminates the worker. These facts do not prove resources remain bounded on a phone.
- The browser adapter currently constructs an unused generic counter for mapped pattern exercises and updates React progress on every result. Their cost has not been profiled; neither is a demonstrated progressive leak.
- Native UI updates have a 200 ms snapshot throttle, but framing status/countdown updates and skeleton mapping still occur on frame callbacks. No render profiler capture is available.
- Browser and native detector confidence differ: the current browser worker uses 0.6 while native uses `CAMERA_CONFIDENCE` 0.35. Browser replay therefore cannot be represented as identical native detector evidence.
- For fly and hip-abduction catalog IDs, the current registry exposes a native pattern, and the browser routes mapped exercises to the local session unless disabled. Both share the general camera hook/native permission path. Whether an administrator override, permissions, device startup or lifecycle state caused the reported “no access” is unknown.
- The weighted-dip mapping and Bradford shared-family behavior are concrete configuration facts. Neither has been shown to explain the recordings because the recordings have not been decoded.

## Test-count reconciliation and actual commands

| Command | Result |
| --- | --- |
| `rtk proxy npx vitest run shared/__tests__/exerciseEngine.spec.ts shared/__tests__/poseSubject.spec.ts shared/landmarkFilter.test.ts mobile/poseStartGate.test.ts mobile/poseCue.test.ts mobile/poseSegments.test.ts --reporter=json --outputFile=output/pose-replay-private/focused-tests.json` | 56 passed, 0 failed |
| `rtk proxy node --test --test-reporter=spec mobile/camera-readiness.test.mjs frontend/tests/pose-tracker.test.mjs frontend/tests/tracking-performance.test.mjs` | 25 passed, 0 failed |
| `rtk proxy npx vitest run shared/__tests__/genericRepCounter.cases.spec.ts --reporter=json --outputFile=output/pose-replay-private/generic-baseline-tests.json` | 20 passed, 4 failed; 24 total |
| `rtk proxy node --test frontend/tests/pose-flow.test.mjs` | 0 passed, 1 failed; expects absent `Pose analysis is not configured` wording |
| `rtk proxy node --test scripts/pose-replay/replay.test.mjs` | 4 new harness checks passed; separate from app accuracy tests |

The previous **81 = 56 + 25**, not 81 shared-engine tests. Across the four application commands above: **106 tests, 101 passed, 5 failed**. The four new harness checks are additional, for **110 total executed tests, 105 passed, 5 failed**. None of these totals establishes real-video accuracy.

The reproduced counter failures remain:

| Existing test | Expected | Actual |
| --- | ---: | ---: |
| Five reps after a one-second rest hold | 5 | 4 |
| 140° rest / 60° ROM, three cycles | 3 | 0 |
| Calibrated shallow cycles | 3 | 0 |
| Mixed full/shallow cycles | 4 | 3 |

No existing test assertion was changed or removed. No runtime fix or acceptance claim is being substituted for the unavailable replay baseline.

## Current 1,500-exercise classification

Ran `rtk proxy node scripts/pose-replay/catalog-audit.mjs`. `catalog-current.json` contains all **1,500 unique IDs**, current family, left/right working triplets and landmark names, recommended view, override, classification and explicit replay-evidence fields. No mapping or tier was changed.

| Current classification | Count |
| --- | ---: |
| Partially supported | 835 |
| Not yet validated | 127 |
| Unsupported | 538 |
| Replay validated | 0 |

The existing generator was not used to extend mappings before replay. Recommended view is kept separate from measured acceptable-angle ranges. The audit file adds traceability, not accuracy evidence.

## Exact inputs needed to resume

1. Make the 20 original videos readable as local files in a folder accessible to the replay process, or restore the authenticated download route. Preserve filenames and original bytes. Returning a local folder path is sufficient; another metadata-only listing will not unblock decoding.
2. Fill `labels.template.json` as described in `scripts/pose-replay/README.md`: confirm exact catalog IDs/variations and counting units; mark each set's boundaries, full/partial totals and cycle times; camera facing/mirroring/view; plate/joint occlusion intervals; intended-subject/crossing intervals; and adjudicated form-rule intervals. Unknown values must remain unknown. A reviewed subset can unblock an initial per-exercise baseline without waiting for every clip.
3. Supply or identify recordings for the eight missing priority exercises: **Assisted Pull-up, Seated Triceps Pushdown, Machine Seated Fly, Barbell Squat, Barbell Standing Bradford Press, Leg Press, Machine Standing Calf Raises, Machine Hip Abduction**. Clarify if an existing clip is intended to represent one of these; do not assume equivalence.
4. Run the replay harness in a desktop environment that can launch Chromium and access loopback. The exact model-check/replay commands are in the README. Current browser startup and network restrictions prevented execution here.
5. Provide a writable git worktree/index to create the requested small commits. The source/tools remain available in the current worktree, uncommitted.

## On-device checklist after the first replay-guided candidate exists

Record phone model, OS, build SHA, APK hash, app/browser version, resolution, lens/facing and thermal/battery state. No new APK has been built in this pass.

- For fly and hip abduction separately: cold start with camera permission denied; grant permission; launch; revoke/regrant in OS settings; relaunch. Record selected exercise ID and administrator overrides and capture permission/model/configured/error events.
- Run a wall-clock 30-minute session: 5-minute warmup, then exercise transitions across presses, dips, alternating rows, preacher curl, leg press, pull-ups and calf raises. Keep annotations tied to set times. Collect memory (JS/WASM/native), inference/capture/overlay timestamps, target frames, processed frames, dropped frames and restart reasons at regular intervals.
- Switch front/back at least five times, including mid-set; pause/resume; rotate the phone; background/foreground; temporarily cover the lens. Record commanded switches separately from uncommanded restarts. Count boundaries during interruption must be labeled uncertain rather than invented.
- Reproduce 25 kg plate occlusion with a visible far limb, then both arms hidden. Confirm low-confidence form suppression and placement hints, and compare full/partial event matches with labels.
- Test normal, fast and deliberately repeated shallow cycles. Include a one-second rest and a bent 140° rest position. Compare event times as well as totals to expose cancelling dropped/double counts.
- Record shoulder presses at front, side and labeled oblique views without assuming that a particular angle is acceptable. Keep Bradford cycles separately labeled and mapped.
- Record close upper-body and lower-body crops, both facings, intended person centered/off-center, a bystander entering and people crossing. Annotate which skeleton belongs to the subject; report crossing failures explicitly.

Until those inputs and runs exist, before/after error, false-cue rate, lag/crash root causes and acceptance status must remain unmeasured.
