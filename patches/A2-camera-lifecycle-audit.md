# A2 camera lifecycle audit — 2026-11-21

Scope: browser stream hook, native camera component and host, readiness state, tracking preview callers and inference teardown. No counting/label changes. Paths and line numbers below refer to the current working tree. Rows group equivalent callers but identify all stream/preview lifecycle branches found in these files. A readiness reset or a skeleton clear is distinguished from physical camera shutdown.

## Findings and test evidence

**Confirmed defect, fixed by 0014-camera-exercise-lifecycle.patch:** a browser getUserMedia request begun for one exercise could resolve after the hook's context changed, attach its stream, and mark the replacement exercise on. The original hook only invalidated requests on start/stop/unmount. The new effect cancels on exercise name/equipment or tracking job/side changes; elapsed-label changes leave acquisition intact. The regression fails before the fix (18 pass, 1 fail with the final test set), and all 19 tests pass after. The test executes the actual transpiled hook using deterministic React hooks, deferred promises and fake tracks. It does not emulate a camera driver.

The pre-fix run is recorded in `a2-before-test.log`. The new assertions were written before the fix; existing expectations were unchanged. A stale pending stream is stopped rather than attached; a new explicit start can acquire the replacement camera. This establishes a transition race, not the cause of the reported phone shutoff.

## Lifecycle paths

| File:line | Trigger | Action | Assessment |
|---|---|---|---|
| frontend/hooks/useCameraStream.ts:63 | release, called by replacement/error/stop/unmount | Clears mute timeout and track listeners, stops all owned tracks, clears srcObject | Intended ownership cleanup |
| frontend/hooks/useCameraStream.ts:70 | explicit stop / finish / close / caller pause | Invalidates pending request, sends native camera-stop, releases stream, idle; optional suppression of auto-start preference | Intended |
| frontend/hooks/useCameraStream.ts:86 | exercise or tracking-job identity change | **New:** stop(true), cancels pending acquisition; elapsed label is excluded | Confirmed defect fixed; old stream previously survived replacement |
| frontend/hooks/useCameraStream.ts:97,137 | start or switch | starting, releases previous browser stream, acquires requested facing | Intended; preview is temporarily blank during switching |
| frontend/hooks/useCameraStream.ts:112 | native preview has no nonzero layout after 30 animation frames | unavailable with specific layout message; no native start | Intended guard; layout timing on phone unmeasured |
| frontend/hooks/useCameraStream.ts:125 | missing getUserMedia / insecure context | unavailable with specific capability message | Intended |
| frontend/hooks/useCameraStream.ts:145 | OverconstrainedError | retries acquisition once with any camera | Intended desktop fallback; other failures go to explicit error |
| frontend/hooks/useCameraStream.ts:154,176 | old request resolves before/after play | stops that request's tracks and returns | Intended; rapid out-of-order front/back test passes |
| frontend/hooks/useCameraStream.ts:159 | track ended mid-set | invalidates request, release, unavailable with “Camera delivery stopped. Enable the camera again or continue without it.” | Intended terminal delivery failure, no automatic reacquisition; manual restart test passes |
| frontend/hooks/useCameraStream.ts:168 | mute | schedules 5000 ms timer; only ends delivery if still muted at expiry | Intended bounded transient tolerance; repeated mute/unmute test passes |
| frontend/hooks/useCameraStream.ts:169,171 | unmute or release | cancels mute timer | Intended; no retained timer in simulation |
| frontend/hooks/useCameraStream.ts:179 | acquisition or video.play rejection, including permission denied/revoked | release, denied or unavailable with specific message | Intended; permission revocation may surface as rejection/ended; no separate permissions watcher |
| frontend/hooks/useCameraStream.ts:191 | switch front/back | starts new facing if on/starting; old request invalidated | Intended; both final facings and stale streams covered |
| frontend/hooks/useCameraStream.ts:199 | native status event idle/denied/unavailable | updates status; removes native preview and disables automatic restart | Intended. Native start/end events are not session-tagged here: stale host status is a code-level risk, not reproduced by these simulations |
| frontend/hooks/useCameraStream.ts:245 | page hidden | stop(true), idle, releases camera; visible does not auto-reacquire | Intended privacy/session boundary; hidden/visible/manual restart test passes |
| frontend/hooks/useCameraStream.ts:257 | unmount | invalidates request, removes listeners/observer, camera-stop, release | Intended; late request tests and listener cleanup checks pass |
| frontend/sections/Coach/GenericTrackingSession.tsx:17–20 | page hidden, Finish, Close | camera.stop(true); Finish captures summary; Close exits | Intended; hidden handler duplicates the hook stop harmlessly |
| frontend/hooks/useGenericRepTracking.ts:40,44,75,79,85,95,98 | worker error, worker timeout, frame extraction failure, unmount/inactive/counter change | terminates worker; missing/stale evidence updates counter/overlay | Inference stops but this hook does **not** stop camera stream; do not equate worker failure with preview shutdown |
| mobile/NativeTrackingCamera.tsx:37 | fail(reason) | terminal callback disposal, error event, deactivation; failed placeholder replaces view | Intended fail-closed |
| mobile/NativeTrackingCamera.tsx:43 | tracking inference errors | tolerates two consecutive errors; third fails. A frame resets error streak. Readiness fails on first error | Intended; before-existing three-error test passes |
| mobile/NativeTrackingCamera.tsx:46 | repeated configuration callback | readiness fails interrupted; tracking ignores duplicate configure | Intended; prevents readiness job resurrection |
| mobile/NativeTrackingCamera.tsx:51–59 | critical thermal state / bad frame metadata | critical heat fails with cool-down message; bad metadata discards tracking frame, fails readiness | Intended; thermal signals are simulated only |
| mobile/NativeTrackingCamera.tsx:63 | camera geometry/lens/zoom/facing change | readiness fails; tracking clears frame sequence and emits geometry-changed, leaving preview active | Intended; counter/guidance reset is not stream teardown |
| mobile/NativeTrackingCamera.tsx:94–114 | options/facing/job change, unmount | old callbacks disposed, timers/listeners removed, model-path loading reset for new job | Intended; rapid switching/late model/exercise replacement test passes |
| mobile/NativeTrackingCamera.tsx:103–110 | missing native module, missing model, startup deadline | fail unsupported/model-error; deadline covers asset loading **and** native configuration | Intended; startup timeout/configure/error/teardown simulation passes |
| mobile/NativeTrackingCamera.tsx:111–113 | AppState non-active / readiness blur | interrupted failure | Intended conservative lifecycle policy; OS inactive transitions can cause deliberate session interruption |
| mobile/NativeTrackingCamera.tsx:116–125 | options.active false or failed | isActive false or replaces camera with loading/error view; configuration clears startup deadline and signals ready | Intended; no actual driver exercised |
| mobile/PoseTrackerNative.tsx:150–173 | initial permission prompt/denial, background, unmount | sets permission, hides camera unless permission+active+unpaused; background suspends counter/clears readiness; cleanup cancels retry | Intended. Permission is requested at mount; subsequent OS revocation is detected only indirectly until remount |
| mobile/PoseTrackerNative.tsx:177 | exercise/name/override change | replaces counter; host key handles exercise/pattern camera remount | Intended; same-pattern counter replacement does not itself stop a stream |
| mobile/PoseTrackerNative.tsx:206 | switch camera | suspends count/guidance, clears retry, clears ready, toggles facing; child key changes | Intended temporary preparing state |
| mobile/PoseTrackerNative.tsx:215 | pause/resume button | suspends counter, cancels retry, clears ready; paused state unmounts camera; resume remounts | Intended |
| mobile/PoseTrackerNative.tsx:228 | geometry-changed | suspends counting/guidance only | Intended; camera remains mounted |
| mobile/PoseTrackerNative.tsx:229–240 | native error | clears ready; retries at 1 s at most three times if active, supported, not too warm; otherwise shows specific error and Retry button | Intended bounded recovery. Pending retry callback checks alive but does not recheck paused/AppState; background race remains plausible, not reproduced by the component-level callback tests |
| mobile/PoseTrackerNative.tsx:350–361 | permission/appActive/paused, retry button | conditional camera mounting; Retry resets retry budget and increments cameraGeneration | Intended explicit user retry. Failed camera may keep a spinner alongside its error text; not evidence of a silent restart loop |
| mobile/App.tsx:220,568,570,649 | native provider close/start/stop, exercise/pattern key | closes or replaces provider session, unmounts/remounts native tracker | Intended |
| mobile/App.tsx:231–234 | inactivity countdown/alarm/stopped | invalidates host preview request and clears cameraPreview | Intended safety/UI policy; can deliberately blank host preview. Native provider tracker is a separate surface |
| mobile/App.tsx:351–390 | start request with invalid geometry, permission denial, acquisition error | no preview; publishes specific unavailable/denied; stale request ID returns without mounting | Intended |
| mobile/App.tsx:404–414 | stop, AppState non-active, native blur, unmount | clears preview, increments request ID, sends idle; removes lifecycle listeners | Intended conservative host policy; a notification shade can trigger native blur even if web visibility did not change. Plausible explanation for host preview stop; real OS transition not reproduced |
| mobile/App.tsx:416–420 | native host front/back switch | changes facing and child key, clears framing | Intended remount |
| mobile/App.tsx:484–486,628–630,640–645 | WebView error/load start/process terminated | clears food camera, stops monitor and native preview, marks host error as applicable | Intended navigation/process ownership cleanup |
| mobile/App.tsx:566,573 | start native tracker or food camera | stops host preview to hand off ownership | Intended |
| mobile/App.tsx:585–609,622 | camera-start/stop; invalid update frame/context; malformed WebView message | replace/stop host preview; invalid payloads fail closed | Intended validation; unrelated malformed message stopping preview is a plausible broad-catch risk, not reproduced here |
| mobile/App.tsx:663–665,696–704 | native tracking error / ordinary CameraView mount error | removes preview, emits unavailable specific error | Intended |
| shared/cameraReadiness.ts:100–122 | stale evidence/reset/expiry | marks readiness unknown/stale, clears evidence dwell | No stream stop: state assessment only; stale and terminal-event tests pass |

## Failure sequences and confidence

| Sequence | Evidence | Result |
|---|---|---|
| acquire exercise A → context switches to B → A's promise resolves → A attaches and marks B on | **Confirmed by failing regression**, now fixed | Old tracks are stopped; status returns idle; explicit new start is available |
| repeated mute <5 s → unmute → delayed timer fires | **Simulated; defect not reproduced** | Timer cleared; on state preserved. A sustained 5 s mute terminates explicitly with a restart instruction |
| ended → stale callback/late frame → preview stuck preparing | **Simulated ended/manual reacquisition; defect not reproduced** | Terminal unavailable, then explicit front-camera start succeeds |
| hidden → visible → automatic re-acquisition loop | **Simulated; defect not reproduced** | Hidden stops; visible does not silently restart; user can start again |
| three consecutive errors → disposed callback emits again → unlimited teardown | **Simulated; defect not reproduced in callback layer** | One terminal failure; successful intervening frames reset streak |
| rapid front/back → old model or getUserMedia resolves late | **Simulated; defect not reproduced** | Last request wins; stale tracks disposed; obsolete native assets/configuration ignored |
| parent retry scheduled → app backgrounds before timer fires | **Plausible from code** | Callback may increment camera generation while inactive; no real-driver reproduction or parent-component simulation. Follow-up A3 should cover the parent retry state machine |
| native host blur → stop preview although web page remains visible | **Plausible, explicit policy** | Deliberate idle message; requires phone verification to determine whether this explains the reported interruption |
| native getUserMedia never resolves / host never sends ready | **Plausible pending startup risk** | Browser hook has no acquisition deadline; native pose child has an initialization deadline, ordinary host CameraView relies on ready/mount error. No driver hang reproduced |

No silent infinite preparing loop was reproduced by these tests. They cannot cover physical drivers, real permission dialogs/revocation, thermal throttling, camera exclusivity, native OS background scheduling, or an installed APK version.

## Verification

- `rtk proxy python patches/a2-check-before.py`: original hook + final tests: 18 pass, 1 fail (exercise-change cancellation); log `a2-before-test.log`. The helper restores the fixed file in `finally`.
- `rtk proxy node --test mobile/camera-readiness.test.mjs`: 19 pass, 0 fail.
- `rtk proxy npx tsc --noEmit -p frontend/tsconfig.json`: passed.
- `rtk proxy npx tsc --noEmit -p mobile/tsconfig.json`: passed.

Only the confirmed exercise-acquisition race is fixed in this patch. No phone behavior, stream retry improvement, deployed fix, or inference performance is claimed. A2 stops here; retry/backoff redesign and lag/counting work are outside this item.
