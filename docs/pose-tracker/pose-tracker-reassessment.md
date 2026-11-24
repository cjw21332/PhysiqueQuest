# Pose tracker reassessment — 2026-11-21

## Findings and changes

The reported failures are consistent with several defects in the local tracking paths:

- The native start gate required hips/legs for bench pressing and both arms for upper-body exercises. It now derives the working triplets from the pattern configuration and accepts one complete visible limb. Both hips/shoulders remain necessary when they define the actual angle (hip abduction/chest fly).
- Bilateral side selection used the elbow/knee confidence even when an endpoint was hidden and locked that selection during the cycle. It now checks the entire triplet and permits an agreeing contralateral measurement (within 25 degrees) without opening a second counting state. Fully hidden joints are not extrapolated into repetitions.
- Single-sample peaks were lost at ordinary inference rates. A subsequent return sample can confirm the peak within 250 ms; minimum duration and observed excursion still apply. Partial and complete repetitions remain separate.
- A visibility-only exercise override accidentally changed per-side families into bilateral counting. Unspecified counting mode now preserves the family mode.
- Form faults were emitted immediately from potentially unreliable geometry. Runtime cues now require high confidence and 600 ms of continuous evidence, clear when measurement is lost, and avoid applying push-up body alignment to bench/machine pressing. Supported, seated and bent-over exercises skip the static torso-lean rule. These are heuristic screens, not validated technique assessments.
- Hidden-point estimates could affect display smoothing and lag behind on reacquisition. Confidence loss now resets the affected coordinate filter. Raw coordinates remain the input to counting.
- Browser streams stopped immediately on `mute` and window focus loss. Temporary mute now has a five-second recovery window; only actual track termination, sustained mute, or page hiding stops delivery. Front/back switching is retained.
- Native inference errors previously caused an immediate camera teardown. Three consecutive errors are now required; successful frames clear the error streak.
- Both local inference paths now request up to three people and select a credible central torso with continuity preference. A large subject displacement clears the current counting cycle, retaining totals. This is geometric continuity, not biometric identification; crossing/overlapping people still need physical testing.
- Mapped browser exercises now use the shared pattern engine locally rather than an external iframe. Browser skeleton drawing uses aspect-fill projection and the same front-camera mirror as its preview. Inference still allows only one outstanding bitmap; no frame queue is introduced.

## Catalog scope

Regenerated and audited all 1,500 actual catalog IDs:

| Classification | Exercises |
| --- | ---: |
| Partially supported | 835 |
| Not yet validated | 127 |
| Unsupported | 538 |
| Fully validated | 0 |

Added experimental chest-fly and machine hip-abduction families. The generator maps three fly variants and one hip-abduction variant using upper-arm/shoulder and hip/knee geometry, respectively. Their counters require the working joints to be visible and favorable projection; these mappings do not establish real-world accuracy. Reverse fly, hip adduction and other excluded movements have not been silently mapped to these new patterns.

Shared changes apply to all exercises using the affected family, rather than only the reported names. Unsupported exercises retain manual logging. Catalog mapping is not equivalent to testing all exercises. Bradford press remains a distinct catalog exercise; an ordinary standing shoulder press must be selected as its own exercise.

## Verification and remaining work

Focused engine, central-subject, filtering, start-gate, cue and skeleton tests passed (56 tests). Frontend and mobile TypeScript checks passed. Camera lifecycle, registry/provider and scheduling tests are also exercised separately, including transient inference-error recovery.

The wider shared suite exposed four pre-existing generic-counter calibration expectations: rest-hold counting, a 140-degree rest position, calibrated shallow cycles, and mixed full/shallow quality. The generic algorithm was not changed to hide those failures. An unrelated existing upload-flow source assertion also expects wording that is absent from CameraCheck. These failures must remain visible in release evaluation.

This change has not been validated against the uploaded exercise recordings, a physical phone camera, a rebuilt APK, or a prolonged multi-exercise session. Do not describe the results as measured device accuracy or a deployed fix. Required acceptance recordings include full/partial labels, visible/occluded arms, both camera facings, fast continuous sets, crowded frames, supported rows, press variations and a 20–30 minute session. Measure count error, false cue rate, frame/inference latency, dropped frames and camera restarts separately.

An entirely hidden movement cannot be recovered reliably from a single camera. Poor viewing geometry should yield uncertainty or placement guidance, rather than fabricated joints, confident form faults, or invented repetitions. Showing fewer joints does not itself reduce model inference cost: the underlying pose model still predicts its full landmark set.
