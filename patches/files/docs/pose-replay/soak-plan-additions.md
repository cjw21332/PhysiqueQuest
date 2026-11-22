# Required additions to the 30-minute device soak

These are acceptance checks, not measurements or runtime behavior changes. Keep the first report's thresholds unchanged. No exercise is validated by this plan.

## Thermal evidence

Record `thermalState` from the device/native inference callback if exposed, with timestamp, phone model, OS, app build, battery/charging state, inference backend, input resolution and camera facing. Preserve transitions (nominal/light/moderate/serious/critical or the platform's actual vocabulary) rather than translating them into invented temperatures.

Record actual device temperature in Celsius only if an accessible sensor exposes it, and identify the sensor (for example, battery temperature is not CPU or skin temperature). Otherwise use `temperatureC: null` and `temperatureUnavailableReason`. Do not estimate heat from battery charge, latency or the phone feeling warm. Align changes in thermal state with latency, frame scheduling and camera lifecycle events.

## Latency trend

After the five-minute warmup, retain one-minute windows through minute 30. For each window record sample count and p50/p90/p95/p99/max for inference, capture-to-result, capture-to-overlay, and result-to-overlay. Unavailable timings remain null; desktop Python inference is not substituted for phone capture-to-overlay.

Record scheduled inference opportunities, processed frames, intentional source decimation, stale candidates, actual decoder drops, queue depth and commanded/uncommanded camera restarts separately. Compare the first and last five post-warmup minutes and plot the complete window trend alongside JS/WASM/native memory and thermal state. Do not report only one aggregate percentile.

## Pull-up and dip endpoint evidence

Annotate full-cycle endpoints and timestamps in the real recordings. A full repetition must demonstrate BOTH exercise-specific endpoints in one bounded, sufficiently visible cycle; an isolated endpoint, a repeated bounce near the same endpoint, or a fully hidden excursion cannot establish a full repetition. Missing evidence must be reported as uncertain rather than filled with predicted joints.

For a pull-up, the bottom is the full-extension arm state and the top is the contracted upper state. For a dip, elbow extension occurs at the TOP, while the bottom has bent elbows. Do not incorrectly require straight elbows at a dip's bottom. Define the intended comfortable depth and endpoint tolerances from the reviewed exercise/view evidence, not a guessed universal angle.

Include: start at either endpoint; start mid-cycle; top-only pulses; bottom-only pulses; incomplete return; one-sided plate/equipment occlusion; both limbs hidden; loss/reacquisition; a pause at an endpoint; normal and fast continuous cycles; alternating bystander motion; front/back camera switching. Review full and partial events separately and match timestamps to expose dropped/double counts that cancel in totals.

Assert from traces that each event called `full` has visible endpoint evidence from the same subject/cycle, with bounded continuity. Specifically flag the CURRENT Weighted Triceps Dips → triceps_extension mapping as a configuration candidate to investigate, not a replay-proven defect or a mapping to silently change. Keep Bradford press separately labeled.

No new counter or mapping should be applied before the labeled current-code baseline has been reviewed.
