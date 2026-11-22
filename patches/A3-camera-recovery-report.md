# A3 bounded camera recovery

Implemented locally; simulated behavior only. No phone, APK or deployment claim. A3 only; no counting thresholds, labels, held-out data or catalog entries changed.

## Recovery contract

- The native tracker and live browser/host tracking screens preserve the selected facing, exercise and accumulated counters. They suspend the in-progress motion on interruption and re-acquire automatically when foreground/focus returns. Explicit Pause/Finish/Close stops recovery; a new exercise invalidates the previous job. Readiness-only Camera Check and the hook's default legacy mode retain explicit-restart behavior; live tracking callers opt in.
- One initial attempt, then at most three automatic retries after 500, 1000 and 2000 ms. Each browser or native-host request has a 15000 ms deadline. Native model/configuration retains the existing 10000 ms inner deadline, now marked with a timeout code. These are engineering bounds, not device-tuned values. Delays allow transient ownership release while limiting churn. A successful recovery does not reset the automatic budget; a manual Try again or selected-facing switch starts a new budget.
- At timeout, a browser permission request cannot be aborted through getUserMedia's API; instead its ticket is invalidated, and any stream it returns later is immediately stopped. The deadline also covers video.play and native-start acknowledgements. Native host status events carry the client generation so a late ready/error cannot complete the replacement request.
- Every delayed callback checks its job ticket, active state, component lifetime and current eligibility. Native exercise changes stop the old controller job before starting the replacement. Background and blur cancel pending timers. Foreground/focus only resumes a session that still wants a camera.
- Camera messages show an attempt number while acquiring/recovering. Interrupted waiting is explicit, and failure provides permission-denied, no-camera, timeout or interrupted-too-often text plus Try again. Thermal native errors retain a separate terminal thermal class with a cool-down message; a hot camera is not retried automatically.
- Invalid JSON, oversized bridge messages, invalid camera geometry/context/facing/generation are ignored before camera ownership changes. Malformed-message catch no longer stops the preview. Genuine explicit camera-stop, navigation and lifecycle interruptions still stop ownership.

## State transitions

| From | Event | To / action |
|---|---|---|
| idle | explicit Start | acquiring, attempt 1/4, deadline armed |
| acquiring / recovering | current ready acknowledgement | ready, deadline cancelled |
| acquiring / ready / recovering | background or native blur | interrupted, camera released, cycle suspended, totals retained |
| interrupted | foreground or native focus | recovering, bounded backoff then new acquisition |
| acquiring / ready | timeout, ended or recoverable error | recovering with next attempt; after budget exhaustion failed |
| any wanted state | permission denied / no camera | failed, specific message and manual Try again |
| recovering | app becomes inactive before timer fires | interrupted; timer cancelled and eligibility rechecked |
| any | stale ticket/old generation callback | ignored; late browser stream disposed |
| acquiring / recovering / ready | explicit facing switch | new acquiring job with chosen facing; old job invalidated |
| any | Pause / Finish / Close / exercise replacement | idle and pending work cancelled; replacement exercise starts a separate job |
| failed | manual Try again | acquiring with fresh budget |

## Patches in order

| Patch | Concern |
|---|---|
| 0015-camera-recovery-state.patch | Shared six-state policy, deadline, backoff, tickets and seven deterministic tests |
| 0016-browser-recovery.patch | Browser/native-host client acquisition deadlines, generation checks, live-screen opt-in, counter motion suspension, visible messages |
| 0017-native-recovery.patch | Native parent automatic foreground recovery and execution-time guards; preserves counter object and facing; timeout reason propagation |
| 0018-host-message-recovery.patch | Host blur/focus signalling, generation-tagged status events, validation/ignore of malformed messages |
| 0019-recovery-integration-tests.patch | Actual-hook and mocked native-parent integration simulations; keeps existing 19 camera tests unchanged |
| 0020-a3-evidence-and-apply.patch | This report, PROGRESS and accepted-series apply script |

`apply-all.ps1` excludes 0010 and DRAFT experiments. It checks applied patches in a temporary copy using reverse checks from newest to oldest, handling overlapping changes, validates the reconstructed forward series before mutation, and skips already-applied patches. It does not use the git index. The series targets the existing workspace baseline, not an otherwise clean public HEAD. Earlier 0001–0008 reference/harness experiments are not silently enabled.

## Tests and evidence

- `rtk proxy node --test mobile/camera-readiness.test.mjs`: 26 passed. Includes the original 19 plus automatic browser background recovery, unresolved acquisition/late disposal, facing switch during recovery/background cancellation, native-host acknowledgement timeout/stale generation, native parent lifecycle/retained totals/retry guard, stale retry after exercise replacement, and live-screen wiring checks. Malformed-message assertions are added to the existing host-validation test without changing its prior expectations.
- `rtk proxy npx vitest run shared/__tests__/cameraRecovery.spec.ts shared/__tests__/exerciseEngine.spec.ts mobile/poseStartGate.test.ts shared/__tests__/genericRepCounter.spec.ts shared/__tests__/genericRepCounter.cases.spec.ts shared/__tests__/trackingAvailability.spec.ts shared/__tests__/poseSubject.scenarios.spec.ts`: 111 passed. Seven policy tests include three rapid blur/focus recoveries and exhaustion, execution-time eligibility, timeout limits and stale tickets.
- `rtk proxy npx tsc --noEmit -p frontend/tsconfig.json` and `rtk proxy npx tsc --noEmit -p mobile/tsconfig.json`: passed.
- Before-fix regressions are captured by `rtk proxy python patches/a3-before-check.py`: restoring the pre-A3 browser hook, native parent or host independently makes the corresponding new test fail (each exit 1). Logs are `a3-before-useCameraStream.log`, `a3-before-PoseTrackerNative.log`, `a3-before-App.log`. The helper restores current source in finally.
- The native parent integration uses mocked React Native camera, permission and lifecycle services; its counter fixture verifies that the same counter object and totals survive recovery. Existing engine tests verify counter suspend/reset semantics. These tests do not execute native drivers.

## Simulation limits

Physical camera drivers, real permission dialogs/revocation, background task suspension and timer delays, thermal throttling, device memory pressure, simultaneous other-app camera ownership, and the installed APK are outside the simulations. Automatic recovery requires the updated frontend/host/native source together. Verify both facings, rapid switches, background/foreground, notification-shade blur/focus, repeated errors and terminal/manual recovery on a rebuilt device installation.
