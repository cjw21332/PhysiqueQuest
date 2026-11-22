# Hold-guard and lag audit — 2026-11-22

## Scratch guard failures

The tested guard waits until a second consecutive departed sample to start timing. It shifts the start timestamp forward by one sample. Most failures below happen because a completed cycle then falls below the existing minimum duration, before the particular behavior under test is reached. The classification is a preliminary assessment of the fixture's intent, not a claim that synthetic motion establishes realistic device accuracy. No expectations were edited.

| Test | Asserted behavior and failure | Classification |
| --- | --- | --- |
| emits depth and tempo feedback from incomplete movements | A shallow cycle emits depth feedback; shifted timing instead reports tempo. | C: feedback regression |
| counts a shallow return as partial and starts the following full squat independently | Counts partial then separate full cycle; delayed start loses the partial. | C: partial-count regression |
| keeps tracking the selected side across consecutive squats when visibility scores change | Preserves two cycles despite changing visibility; cycles are lost before side selection can be assessed. | C: count regression |
| keeps completed repetitions but discards an interrupted movement when tracking is suspended | Completed rep survives suspension; initial cycle is lost. | C: count regression |
| counts complete squat cycles and rejects an incomplete one | Closed cycle counts, unfinished descent does not; closed cycle is lost. | C: count regression |
| counts each side separately for per-side patterns | Unilateral movement counts on working side only; cycle is lost. | C: unilateral regression |
| counts a bilateral movement once even when both sides return together | One bilateral cycle produces one rep; cycle is lost. | C: bilateral regression |
| handles a 1000 ms landmark gap without double counting | Preserves completed total through occlusion; completed cycle is lost first. | C: count regression |
| handles a 2000 ms landmark gap without double counting | Same assertion with longer gap; completed cycle is lost first. | C: count regression |
| handles a 4000 ms landmark gap without double counting | Same assertion with longer gap; completed cycle is lost first. | C: count regression |
| produces the same repetition count for the same movement at 10 fps and 15 fps | Three cycles should count at both sampling rates; shifted duration loses them. | A: valid sampling-rate consistency behavior removed |

`rtk proxy npx vitest run output/hold-guard-scratch/shared/__tests__/exerciseEngine.spec.ts --reporter=verbose`: 31 passed, 11 failed. A weaker +50 ms minimum-duration margin passed these 42 tests, but at 15 Hz gave c01 4/0, c06 2/4, c15 2/5, c17 5/2; the requested c17 5/0 condition was missed. It was not retained. The tests are synthetic and neither outcome proves behavior on a phone.

## Current implementation audit

- `frontend/hooks/useGenericRepTracking.ts:26` creates a worker in its effect; `:98` clears timer/timeout, removes battery listeners and terminates the worker on cleanup. The effect depends on `counter` (`:99`); `counter` depends on config/pattern/override/name (`:21`), so changes in those identities recreate worker/model. This is a source-path observation, not measured proof of repeated initialization during a session.
- `frontend/workers/pose.worker.ts:15` closes a detector on dispose/re-init; `:27` closes stale initialization results. Worker termination is used by the hook, but explicit detector close on termination is not observable from JavaScript.
- `frontend/hooks/useGenericRepTracking.ts:79` polls every 50 ms and sets `busy` before awaiting bitmap creation (`:91`); it skips while busy (`:90`) and clears busy on a result (`:48`). This prevents a queue of normal inference submissions in this path; it intentionally skips polling opportunities. It is not a measured drop rate. `:94` closes a bitmap if the effect stopped during creation; `frontend/workers/pose.worker.ts` closes received bitmaps in `finally`. A postMessage exception after bitmap creation is a potential ownership gap; its occurrence and memory impact were not measured.
- `frontend/hooks/useGenericRepTracking.ts:51-68` clears and redraws the skeleton for every result. No canvas timing was measured. `shared/landmarkFilter.ts:23-48` allocates filtered points, raw copies, and a returned copy each update; arrays are replaced rather than appended. The soak measured filter CPU but not allocation counts or browser canvas cost.
- `frontend/hooks/useCameraStream.ts:191-192,281-298` pairs track and window/document listener registrations with cleanup. The soak did not exercise these listeners, camera ownership, or React re-renders.
- Current `shared/movementTelemetry.ts` is absent, and `useGenericRepTracking.ts` contains no trail or reference-overlay feature from the old experimental patches. Their enabled cost is unmeasured. The ordinary skeleton canvas remains on in this path; do not call the skeleton overlay off by default.

## Soak

`rtk proxy node --expose-gc scripts/pose-replay/landmark-soak.cjs 30` replays selected landmarks at simulated 15 Hz for 30 simulated minutes, switching among c01/c06/c15/c17 each minute. It runs unpaced in Node, invokes the real shared pattern counter and display filter, and forces GC after each simulated minute. It does not run a camera, model, actual frame scheduler, canvas, React, browser worker, or operating-system thermal controls. Full per-minute data: `output/pose-replay-private/landmark-soak.json`.

| Minute | Heap MiB | RSS MiB | Counter + filter p95 ms |
| ---: | ---: | ---: | ---: |
| 1 | 43.85 | 166.45 | 0.171 |
| 5 | 43.55 | 175.32 | 0.139 |
| 10 | 43.55 | 174.25 | 0.152 |
| 15 | 43.58 | 174.46 | 0.105 |
| 20 | 43.59 | 175.18 | 0.160 |
| 25 | 43.60 | 175.13 | 0.133 |
| 30 | 43.59 | 174.97 | 0.101 |

Heap rose about 0.04 MiB and RSS fell about 0.36 MiB between minutes 5 and 30. No monotonic growth was observed in these domains in this simulation. Zero of 27,000 measured processing samples exceeded 66.7 ms; this is an over-budget calculation, not measured dropped frames. Camera restarts are unmeasured. There was no fix or after-fix run. Debug instrumentation, realistic browser drawing and overlay-on benchmarking remain open.
