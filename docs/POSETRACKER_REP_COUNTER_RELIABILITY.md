# Rep-counter reliability: synthetic test status

The corrected bilateral fixture tests the real 2D geometry path with both knees, verified landmark visibility, and known angles. The targeted suite passes 51 tests; the full shared suite has 76 passed and five failed. The five outstanding cases concern existing calibration scenarios and remain under investigation. No production counter changes were made.

Synthetic tests cover a normal full movement, partial movement, sustained stability fault, frame-stall loss at 500/501 ms, explicit missing frames at 500/501 ms, restoration without an interrupted count, a short visibility dip, preserved completed totals after a gap, in-progress gap, and session reset. Existing shared cases cover unilateral, bilateral, alternating and isometric modes; not every case passes. The normal state trace and exact commands are in `POSETRACKER_REP_COUNTER_FAILURE_ANALYSIS.md`.

A fast sequence with two peak samples counts when it satisfies the configured duration. An otherwise qualifying cycle with only one peak sample is missed because the first peak sample transitions to `MOVING` without also checking the peak threshold. One sample could also be a landmark outlier, so an acceptance policy and noise-focused regression tests are needed before modifying this behavior.

These are deterministic software tests, not real-camera performance evidence. Camera views, visibility and occlusion, capture cadence, exercise-specific overrides, and physical-device reliability remain to be tested. No workouts or user data were created.

Phase 2B update: a minimum-observed-span guard was added to prevent independent endpoint clamps manufacturing sufficient range. The latest full shared run has 81 passed, 4 failed, and 0 skipped across six files. The targeted suite still passes 51 tests. Calibration and single-sample peak policy remain unresolved; see `POSETRACKER_CALIBRATION_RELIABILITY.md`.

Phase 2C: 83 passed and 4 failed in the full shared suite after adding two characterization tests. See `POSETRACKER_CALIBRATION_POLICY_DESIGN.md` and its linked per-frame traces. The proposed policy is not implemented or validated on a physical device.
