# Calibration investigation: incomplete

This report describes synthetic software tests, not measured human motion or device validation. Production model assets and datasets were not changed.

## Lifecycle actually implemented

`update` validates finite, strictly increasing timestamps, starts the session clock on the first timestamp even if landmarks are invalid, checks for a gap larger than `maxRepDurationMs`, calculates the primary angle, handles loss and recovery, applies EMA, and bypasses calibration for isometric holds. For other movements it calls `updateCalibration` **before** calculating progress and updating the rep state machine, including while a rep is active. Before calibration is available the configured start and peak angles are used, so tracking does not wait for calibration.

The default warmup is 3,000 ms measured from the first frame timestamp, not from the first valid landmark. After the boundary, valid primary angles are sampled; invalid angles return before sampling. Five samples are required. Samples older than 10,000 ms are removed, and the sorted 5th/95th percentile index values are selected. Each endpoint is independently clamped to 0–180 degrees and within 45 degrees of its configured endpoint. Both the observed span and clamped span must now reach the existing maximum of 30 degrees and 40% of reference ROM. Accepted values replace previous values immediately; there is no separate stability flag. Progress uses the calibrated endpoints and the peak threshold can use `max(0.4, minCalibratedRom / calibrated range)`; completion still requires timing and (when calibration is enabled) 30 degrees observed ROM.

Brief invalid frames do not add samples; prolonged loss clears calibration, and recovery resets motion and calibration but does not restart `sessionStartMs`. At a long timestamp gap motion is reset or resynchronized, while calibration is generally retained. `resetSession` resets motion, totals, calibration and the session clock. Drift handling after two counted calibration reps can clear calibration and motion after a sustained 19–35 degree difference for over 2,000 ms. A rest pose is not independently identified: the extrema are treated as endpoints. These are implementation facts, not a proposed universal exercise policy.

## Five original failure traces

The diagnostic test `shared/__tests__/calibrationDiagnostics.spec.ts` uses the same nondegenerate knee geometry and checks actual bilateral angles. `node_modules\\.bin\\vitest.cmd run shared/__tests__/calibrationDiagnostics.spec.ts --disableConsoleIntercept` prints the trace. Input begins at 100 ms, advances in 100 ms steps, and the warmup ends at 3100 ms. The following traces were captured before the span guard; the first four outcomes are unchanged after it.

| Case | Trace and first failed assertion | Assessment |
| --- | --- | --- |
| Five reps after rest | 11 frames at 140 degrees, then five cycles; default EMA 0.35. First frame already enters MOVING because the configured rest is 170. First calibration accepted at 3700 ms, rest 137.6 and peak 101.6; rolling peak changes while AT_PEAK. Four `rep_counted` events; expected five. | Initialization relative to configured rest and calibration changes during movement require further investigation. The trace does not establish which rep should count or a safe general correction. |
| 140-degree rest | Three cycles of 140/125/110/95/80/95/110/125/140/140 end at 3000 ms, before the 3100 ms warmup boundary. Zero samples, no calibration, final state AT_PEAK, count zero vs three. | The requested adaptive calibration is never reached; without it, 140 has progress 0.375 relative to 170/90 and is outside the 0.2 return zone. Whether early reps should use a different rest policy is unresolved. |
| Shallow | Three cycles 160 to 100 and back, 4200 ms total; first accepted calibration at 4000 ms (rest 150/peak 100), then rest 160 at 4100 ms. Three partial events and zero full counts vs three. | Most movement preceded calibration; partial treatment may reflect intended policy. A reliable policy for counting individually shallow reps is not established. |
| Mixed | Peaks 80/80/110/80; calibration first accepted at 3500 ms, with 160/80 endpoints. First two and last repetitions counted; 110-degree peak emitted `rep_partial`. Three full vs expected four. | The shallow cycle occurs before the 3100 ms warmup; expectation assumes a calibrated shallow-rep policy not currently present. |
| Brief shift | After two full cycles ending at 2200 ms, prior calibration is null. Shift is 140 for 1500 ms followed by 160 for 1000 ms. Before repair, calibration accepted at 3800 ms with rest approximately 160 and peak 125 despite only 140–160 observed; expected null. | Not a floating-point comparison problem: endpoint clamping expanded 20 observed degrees to 35. Guarding the observed range fixes this original test. |

The diagnostics print per-case accepted endpoint changes, sample count and extrema, state-change and rep events, and final state. They do not yet provide a complete per-frame audit of all requested cases, or establish the clinically or biomechanically appropriate definition of a repetition.

## Verified repair

Before modification, the new synthetic regression with angles 160/140/140/140/160 at timestamps 100–500 ms, warmup explicitly set to zero and calibration enabled, failed: calibrated rest was `159.99999999999997` instead of null. In `shared/genericRepCounter.ts` an observed-span check now applies the existing minimum before endpoint clamping; no threshold was lowered. The regression and the original brief-shift test now pass. The check does not prove all accepted endpoint values correspond to observed positions, nor does it settle whether changes should be deferred until a repetition ends.

## Verification and remaining work

`node_modules\\.bin\\vitest.cmd run shared/__tests__`: 6 files, 5 passed, 1 failed; 85 tests, 81 passed, 4 failed, 0 skipped. The four failures are the first four cases in the table. `node_modules\\.bin\\vitest.cmd run shared/__tests__/genericRepCounter.spec.ts shared/__tests__/exerciseEngine.spec.ts shared/__tests__/videoAnalysisPipeline.spec.ts`: 3 files passed; 51 tests passed, 0 failed, 0 skipped.

New tests cover warmup boundary, four versus five samples, minimum observed span, missing frames, prolonged loss and recovery, and session reset. Existing tests include unilateral, alternating and holds. More explicit coverage is needed for interrupted warmup, timestamps and inactivity boundaries, calibration reset during movement, stability after multiple repetitions, and per-family behavior. No proposed universal warmup or shallow-counting policy should be deployed without resolving those cases, collecting representative ground truth, and assessing false positives.

Phase 2C adds per-frame synthetic traces and characterization of invalid initial frames and mid-rep acceptance. Policy remains partial and is not implemented; see `POSETRACKER_CALIBRATION_POLICY_DESIGN.md`. Latest full shared run: 83 passed, 4 failed, 0 skipped, 6 files.
