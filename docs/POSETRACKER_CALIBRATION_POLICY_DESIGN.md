# Calibration policy design — preliminary, not implemented

Decision: **POLICY PARTIALLY ESTABLISHED**. Frame-level synthetic traces: [`POSETRACKER_CALIBRATION_FRAME_TRACES.jsonl`](POSETRACKER_CALIBRATION_FRAME_TRACES.jsonl). Each line records timestamp, measured bilateral angle, EMA, valid sample count, warmup status, endpoints, state, displayed progress, observed ROM, events and totals. `observedRom` is the counter's current internal rep span and resets on completion; it is not a ground-truth annotation. Reproduce with PowerShell: `$env:POSE_CALIBRATION_TRACE='1'; node_modules\.bin\vitest.cmd run shared/__tests__/calibrationDiagnostics.spec.ts --disableConsoleIntercept`. Filter JSON records with `rawAngle` to reconstruct the four sequences. The extra summary JSON is not a frame. This is software evidence, not camera or biomechanical validation.

## Current state transitions

Calibration and rep state are coupled but calibration has no explicit readiness state. Every valid non-isometric frame updates calibration before progress and transitions; thresholds **can change within a rep**. The timing clock starts on the first finite monotonic frame even when no pose is valid. Tracking uses configured thresholds until both calibrated endpoints exist.

| Current state | Trigger and conditions | Next state, calibration, counts and events |
| --- | --- | --- |
| Session initial | First accepted timestamp | `AT_START`; start warmup clock, even if pose invalid; zero counts. |
| Any active state | Valid primary pose, warmup elapsed | EMA sample enters rolling window; after at least 5 samples and span guards endpoints can be replaced immediately. No calibration-ready event. |
| `AT_START` | Progress > 0.05 | `MOVING`; starts timer; emits state change; peak is not evaluated on this same frame. |
| `MOVING` | Progress reaches configured or calibrated peak threshold | `AT_PEAK`; emits state change; no count yet. |
| `MOVING` | Returns to start tolerance before peak | `AT_START`; emits partial if max progress > 0.4, then state change. |
| `AT_PEAK` | Returns to start tolerance | `AT_START`; count when duration, ROM and active faults permit, otherwise partial or fault handling; emits state change. |
| Any | Invalid pose begins | Remains in state until loss timeout; no valid calibration sample. |
| Any | Missing pose longer than timeout, or host `tick` past timeout | `VISIBILITY_LOST`, reset calibration and emit loss once. The two clocks begin at first invalid frame and last frame respectively. |
| `VISIBILITY_LOST` | Valid pose returns | Reset motion and calibration; emit restoration; process frame from `AT_START`. Session warmup clock is retained. |
| Any | Gap exceeds maximum rep duration | Reset/resync motion and preserve totals; calibration generally retained. Resync can mark calibration reps at least two. |
| Any | Session reset | Clear motion, counts, samples, endpoints, loss and session clock; no rep event. |

`RETURNING` exists in the type but this state machine does not enter it. Isometric holds use a separate path. Ordinary stable rest frames do not inherently reset calibration. Drift reset may reset motion and calibration after two calibration reps and a sustained 19–35 degree shift, subject to the current rolling endpoint logic.

## Four observed scenarios

Angles are checked through actual bilateral geometry at 100 ms intervals. Expected counts are existing test assertions, not accepted product requirements.

| Case | First observable divergence | Result and interpretation |
| --- | --- | --- |
| Rest then five reps | At 100 ms the 140-degree rest is already `MOVING` relative to configured 170/90; first count is delayed until 4700 ms, after the second movement begins. | 4 vs 5. EMA and mid-rep calibration changes affect boundary detection; cannot assign a definitive cause without a tested counterfactual. |
| Rest 140 | At 100 ms already `MOVING`; first return at 900 ms remains `AT_PEAK` because 140 is outside configured start tolerance. | 0 vs 3. Entire sequence ends before warmup 3100 ms, so no adaptive calibration exists. |
| Shallow | At first return, 1100 ms emits `rep_partial`, not `rep_counted`. | 0 full, 3 partial vs expected 3 full. Calibration only starts affecting the end of the third cycle; current contract distinguishes partial events from full counts. |
| Mixed | Third return, 2600 ms, emits `rep_partial`, rather than a counted partial-quality rep. | 3 full and 1 partial vs expected 4 counted; the third cycle ends before warmup. |

## Alternatives

The first four scenarios alone cannot determine which policy is correct, and valid-pose warmup must define whether interruptions pause cumulative time or restart a continuous interval. Risk assessments below are design judgments, not measured outcomes.

| Policy | Initial rest / delayed movement | Shallow and mixed depth | Visibility, rest and drift | Noise and false/missed counts |
| --- | --- | --- | --- | --- |
| A: current fixed warmup | Configured range immediately; atypical rest can miss early reps; delay consumes warmup. | Early shallow movements remain partial; later extrema may adapt. | Invalid frames consume warmup; loss resets endpoints; rest contributes samples; rolling drift can alter endpoints mid-rep. | Fast availability risks noisy endpoints; fallback can miss off-reference movement. |
| B: valid-pose warmup | Invalid start no longer consumes warmup; delay with valid pose still does not establish movement range. | Still cannot retrospectively calibrate early cycles. | Must explicitly define interruption and drift; rest alone has no span. | More delay may miss early reps; validity alone does not prove quality. |
| C: explicit readiness | Status makes unknown calibration visible; configured fallback or paused counting is a separate decision. | Can label uncertainty; relative range should not imply full reference ROM. | Explicit collecting/ready/stale states help loss and recalibration handling. | Readiness needs tested criteria; pausing increases missed counts, fallback risks false ones. |
| D: freeze active rep | Does not solve initial wrong rest or pre-warmup cycles. | Makes per-rep thresholds consistent; does not decide shallow classification. | Candidate may be applied on a verified safe boundary; loss should discard pending motion. | Reduces mid-cycle drift but stale thresholds can miss real movement; does not remove noisy candidate endpoints. |
| E: hybrid B+C+D | Valid-pose readiness plus configured fallback can limit startup delay but off-reference starts remain unresolved. | Keep reference-quality separate from individualized completion. | Clear stale/recovery states; defer endpoint activation to safe boundary; define exercise-specific rest and recalibration. | Better traceability, but requires validated candidate stability, risk testing and a UI contract. |

## Recommendation for a future implementation

Prefer a **hybrid proposal**, not a finalized algorithm: start timing only after valid required landmarks; require a defined valid-time continuity rule and sufficient valid samples and observed span; collect candidate calibration separately; expose readiness and quality; freeze endpoints for the duration of each rep; apply a validated candidate only at a verified safe boundary. Continue configured counting before readiness only for exercise configurations with adequate evidence and label it uncalibrated; otherwise show uncertain/manual tracking. Retain counts across rest; reject invalid samples and discard interrupted motion after sustained loss; mark calibration stale and explicitly reacquire after a defined loss/drift interval. Session reset clears it. The present 3-second/5-sample defaults and 30-degree/40% guard are existing values, not validated universal recommendations. Required stable duration, sample diversity, evidence for initial rest, boundary detection, loss recovery, and drift thresholds remain unresolved.

Distinguish **completed movement** from **reference full ROM**: full requires a reliable completed cycle meeting validated exercise-specific reference criteria; partial reaches a defensible minimum but not full reference range; invalid lacks sufficient movement or violates timing/quality requirements; interrupted loses essential observations; uncertain lacks sufficient evidence. User-relative calibration may help recognize a completed limited-range cycle but cannot establish biomechanical equivalence to reference full ROM. Existing `rep_counted` with `quality: partial` and separate `rep_partial` need an explicit product/UI contract before choosing totals. Isometric holds, alternating/unilateral movements, bilateral asymmetry and exercise-specific camera constraints need distinct treatment; no one-size-fits-all ROM policy is justified.

Five samples make the percentile indexing effectively select extremes, so a single outlier can affect endpoints. The 10-second window and immediate replacement can shift thresholds inside a rep; five frames alone do not establish stability. A stability window may reduce transient sensitivity but delay adaptation; deferred application protects a rep but not candidate quality; bounded changes can hide real shifts; explicit recalibration gives control but interrupts tracking. No numeric new tolerance is proposed without representative data and false-count evaluation.

## Verification and gaps

Full command `node_modules\.bin\vitest.cmd run shared/__tests__`: 6 files, 5 passed and 1 failed; **83 passed, 4 failed, 0 skipped**. New characterization tests prove invalid first frames consume warmup and endpoints can be accepted while active. Existing synthetic tests exercise current warmup, loss, reset, shallow/mixed movement and rest. A separate executable policy model for deferred updates is **not yet implemented or tested**; policy-focused cases for invalid-start interruption, delayed first movement, long inactivity, drift, post-calibration mixed depth and deferred safe-boundary behavior remain necessary. Four original expectations remain unchanged and failing. No production code changed in this phase.
