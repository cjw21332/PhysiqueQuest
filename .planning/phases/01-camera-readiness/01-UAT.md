---
status: testing
phase: 01-camera-readiness
source: [01-VERIFICATION.md]
started: 2026-10-21
updated: 2026-10-21
---

## Current Test

number: 1
name: Actual camera geometry and calibration
expected: |
  On actual web, Android and iOS targets, record device/OS/build/capability and the 15 trial cases per surface in 01-CALIBRATION.json. Compare both lenses, crop, orientation/mirroring, clipping, body/occlusion and lighting. Calibration-dependent rows remain Unavailable until evidence supports their policy values. No media or participant identity is recorded.
awaiting: actual device observations

## Tests

### 1. Actual camera geometry and calibration
expected: Coach → Start session → Camera check uses fresh camera frames. Record all 45 trials and six calibrated/unavailable decisions honestly; untested surfaces stay pending. Native tests need development builds with the pose module; Expo Go verifies fallback only. Record scalar results and limitations. Do not enable thresholds from synthetic tests.
result: [pending]

### 2. Actual-device lifecycle, performance and manual continuation
expected: Denial/revocation/busy camera, switch, background/notification shade, lock/unlock, exit/reopen and failures clear old results without automatic background reopening. Restart needs fresh observations. Slow/thermal behavior stays bounded, old resources release, and camera-off continuation follows the normal workout flow. Record latency/heat/cleanup and false greens.
result: [pending]

### 3. Native accessibility and checkpoint approval
expected: Verify TalkBack/VoiceOver focus and limited announcements, system text scale 1.5+, unclipped actions and 48px/dp targets on Android/iOS builds. Apply only evidence-supported calibration values with trial IDs, then rerun Plan 01-03 Task 2 checks. Missing evidence keeps the checkpoint unresolved; generic approval does not establish device results.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

No software blocker found. Actual-device evidence and calibration remain outstanding; see 01-VERIFICATION.md and 01-CALIBRATION.json.
