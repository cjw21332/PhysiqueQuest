---
phase: 01-camera-readiness
verified: 2026-10-20T16:45:25Z
status: human_needed
score: 8/14 must-haves verified
covered_files:
  - .planning/phases/01-camera-readiness/01-01-PLAN.md
  - .planning/phases/01-camera-readiness/01-01-SUMMARY.md
  - .planning/phases/01-camera-readiness/01-02-PLAN.md
  - .planning/phases/01-camera-readiness/01-02-SUMMARY.md
  - .planning/phases/01-camera-readiness/01-03-PLAN.md
  - .planning/phases/01-camera-readiness/01-03-SUMMARY.md
  - .planning/phases/01-camera-readiness/01-CALIBRATION.json
  - .planning/phases/01-camera-readiness/01-VALIDATION.md
  - frontend/app/globals.css
  - frontend/hooks/useCameraReadiness.ts
  - frontend/hooks/useCameraStream.ts
  - frontend/sections/Coach/CameraCheck.tsx
  - frontend/tests/browser/camera-readiness.spec.mjs
  - frontend/tests/camera-readiness-calibration.test.mjs
  - frontend/tests/camera-readiness.test.mjs
  - frontend/tests/mobile-redesign.test.mjs
  - frontend/tests/pose-flow.test.mjs
  - frontend/workers/pose.worker.ts
  - mobile/App.tsx
  - mobile/NativeTrackingCamera.tsx
  - mobile/camera-readiness.test.mjs
  - shared/cameraReadiness.ts
covered_digest: "v2:sha256:432ee7b0b062455713c94df40cbead7cb6a9e45b71b77e1e15b8bb92fb9bf8bc"
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 7
  total: 7
  not_honored: []
human_verification:
  - test: "Actual web, Android and iOS camera geometry and calibration"
    expected: "Record all device/build metadata and all 15 trial cases per surface; evaluate both lenses, visible crop, rotation/mirroring, body/occlusion and lighting. Enable only evidence-supported checks; retain Unavailable for unresolved checks."
    why_human: "No actual target camera/build was tested. All 45 physical trials and six calibration decisions are pending; synthetic geometry cannot establish physical accuracy. Native geometry backstop abstains with reason insufficient_spec (no explicit device evidence)."
  - test: "Actual-device lifecycle, performance and manual continuation"
    expected: "Permission denial/revocation, camera busy, switch, background/notification shade, lock, exit/reopen and failures clear old results; reopening needs fresh observations. Slow/thermal operation stays bounded, resources release, and camera-off/manual continuation creates the normal workout."
    why_human: "Executable tests verify controlled software boundaries; real camera/OS/thermal behavior and a real development build remain unobserved."
  - test: "Actual native accessibility and final checkpoint approval"
    expected: "On Android and iOS development builds, verify TalkBack/VoiceOver, focus, limited announcements, system text scale 1.5+ without clipping, 48px/dp controls and manual continuation. Record observed limitations, then rerun Task 01-03-02 checks after any policy changes before approval."
    why_human: "UI-SPEC/Plan 03 accessibility backstop abstains with reason insufficient_spec. Browser DOM assertions and TypeScript/build success cannot establish native OS accessibility."
---

# Phase 1: Camera Readiness Verification Report

**Phase Goal:** Users can set up their camera using truthful, stable local feedback about connection, visible body, scene lighting and approximate framing while retaining manual workout continuation.
**Verified:** 2026-10-20T16:45:25Z (October 21 in Asia/Singapore)
**Status:** human_needed
**Re-verification:** No — initial verification; no previous VERIFICATION.md existed.

The software implementation is substantive and connected. This phase is **not complete**: Plan 01-03 Task 2 is an unresolved `blocking-human` checkpoint. Actual browser-camera, Android and iOS evidence is absent. All six full-body/lighting/framing calibration flags are intentionally false, with no lighting band; these safeguards establish honest unavailability, not hardware verification. No implementation blocker was found in this bounded verification.

## Goal Achievement

### Observable Truths

Roadmap SC1–SC5 remain the contract. Plan truths that restate them are merged into those rows; extra plan details are retained below. UNCERTAIN items are WARNINGs requiring the human decision above, never passes or implementation failures.

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | SC1: User can distinguish fresh camera delivery from detection and see separate body, scene-brightness and approximate framing checks matching visible crop/orientation/mirroring; ambiguous evidence stays unknown, absent bodies never mean move closer, and no meter/lux/subject-lighting guarantee appears. | UNCERTAIN — WARNING | `CameraCheck.tsx` renders four independent checks; `pose.worker.ts` samples local brightness; shared projection/evaluation tests pass. Physical preview agreement is unobserved and body/lighting/framing remain Unavailable. Covers Plan 01 D-02 and Plan 02 D-02. |
| 2 | SC2: Stable ready/adjust/unknown results expire; switch/off, geometry, background/blur, exit, failures and thermal pause clear old evidence; delayed/malformed results cannot restore a pass. | VERIFIED (software boundaries) | Controller dwell/expiry/generation tests and native receiver/callback tests run in this verification. Both actual-hook/component lifecycle review regressions pass. Source generation guards, disposal, terminal latching and native thermal deactivation are wired. Physical OS behavior remains in human item 2. Covers Plan 01/02 D-05 and Plan 03 D-03/D-05. |
| 3 | SC3: Local browser/native readiness uploads/stores no camera frames or readiness records/credentials, preserves workout/rep/upload contracts, releases obsolete resources and bounds inference. | UNCERTAIN — WARNING | Local worker and native adapter are wired; browser request/manual-workout regressions and compact bridge tests corroborate software behavior. No actual native development build was exercised. Includes Plan 02 D-01/D-04 and privacy/compatibility portions of Plan 03. |
| 4 | SC4: Existing camera-check layout provides actionable text, accessible announcements/labels, text scaling, 48px/dp controls and meaning beyond color; failures permit manual continuation. | UNCERTAIN — WARNING | Source has text/icons, one polite summary, retry and unrestricted continuation; CSS and browser target/wrapping assertions exist and passed in the supplied execution run. Native system scaling, TalkBack/VoiceOver and usability require actual builds. Covers Plan 01 D-06 and native accessibility portion of Plan 02. |
| 5 | SC5: Reproducible regressions and recorded physical front/back, geometry, lighting, diversity, lifecycle/performance outcomes support calibrated thresholds or unavailable checks; untested hardware is explicit. | UNCERTAIN — WARNING | Test implementations are substantive; four evidence guards pass independently. JSON has three untested device slots, 45 pending trials and six pending decisions. Unavailable policy is verified; physical observations/checkpoint are still pending. Covers Plan 03 D-07 and D-02/D-07. |
| 6 | Plan 01 D-01: Browser readiness uses bundled MediaPipe worker and local brightness sampling without frame upload/storage. | VERIFIED | Hook transfers a bitmap to the local worker; worker loads local WASM/model, produces landmarks and normalized 32×32 weighted RGB brightness, then closes bitmap. Inspected tracer wraps the real Worker rather than fabricating inference output; recorded execution includes its pass. |
| 7 | Plan 01 D-03: Unknown/denied/unsupported/failed states keep Start session and explicit Continue without camera available. | VERIFIED | Start is unconditional; explicit continuation calls `stop(true)` before `onStart`. Browser regressions assert normal workout POST and track release for denial, unsupported, model failure and stale delivery. Actual device continuation is still a human check. |
| 8 | Plan 01 D-04: Readiness is independent of exercise-specific rep joints; uploaded analysis and API workout records retain contracts. | VERIFIED (software contracts) | Worker has distinct `readiness-frame` and legacy rep `frame` branches; native producer preserves request/side/three-joint tracking. Only explicit Analyze video calls `api.analyzePose`; upload MIME/20MB guards remain. Recorded provider/workout tests corroborate compatibility; remote-provider/database operation is not claimed. |
| 9 | Plan 01 D-07: Synthetic software evidence does not enable uncalibrated policies in normal use. | VERIFIED | `readinessPolicy.calibrated` has six false flags and no lighting band. Calibration guard independently rejects unsupported provenance, numeric disagreement and invented hardware passes. Synthetic enabled policies exist only inside tests. |
| 10 | Plan 02 D-03: Expo Go/missing module/denied permission/model/camera failures have truthful fallback and manual continuation. | VERIFIED (software capability routing) | `nativePoseAvailable` gates native module loading; one ordinary `CameraView` fallback emits unsupported capability rather than fresh-frame evidence. Permission/error source branches and terminal receiver latching preserve unknown states. Actual installed-device behavior remains pending. |
| 11 | Plan 02 D-06/D-07: Existing overlays use validated status vocabulary and native calibration/accessibility remains explicitly pending. | VERIFIED | Native host validates status/session/generation and maps framing copy locally; overlay uses `nativeFramingText`. UI-SPEC, calibration record and checkpoint retain explicit physical limitations. This verifies the pending designation, not accessibility success. |
| 12 | Plan 03 D-01/D-04: Automated privacy/bridge/manual/upload/hidden-rep/workout regressions distinguish live local readiness from explicit upload. | VERIFIED (test implementation and recorded execution) | Browser tests inspect requests, storage keys, track cleanup and workout-create payloads; native fixtures carry compact observations; source retains hidden tracking/upload paths. Supplied final run executed 30/30 browser tests. API responses/native boundaries are simulated. |
| 13 | Plan 03 backstop: Actual Android/iOS crop, orientation and mirroring agree with evaluated visible bounds before verification. | UNCERTAIN — WARNING; insufficient_spec | Both native device slots are untested and their geometry trials pending. Mathematical projection and synthetic bridge tests cannot certify actual native preview geometry. |
| 14 | Plan 03 backstop: System font scaling, TalkBack/VoiceOver, thermal slowdown and background/reopen are usable on each native build marked tested. | UNCERTAIN — WARNING; insufficient_spec | No native build is marked tested. No explicit held-out/device evidence exists; the backstop cannot pass vacuously because tested=false. |

**Score:** 8/14 truths verified; 6 UNCERTAIN with physical/human evidence outstanding. `behavior_unverified: 0` means no additional untested software transition was identified; it does not mean hardware was tested.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `shared/cameraReadiness.ts` | Pure contract, validation, evaluation/controller and bounded native receiver | VERIFIED | Finite/bounded fields; cover projection; bilateral/head/feet checks; independent brightness; confidence/size policy; dwell/expiry; session/generation/sequence rejection. Used by both adapters. |
| `frontend/hooks/useCameraReadiness.ts` | Browser acquisition/worker lifecycle and native consumer | VERIFIED | Advancing decoded frames separately establish connection; bounded one-in-flight sampling/deadlines; local receive clock; cleanup and generation checks. |
| `frontend/workers/pose.worker.ts` | Local readiness result alongside rep messages | VERIFIED | Actual local model/WASM inference, full landmarks, brightness scalar, finally-close; retains rep branch. |
| `frontend/hooks/useCameraStream.ts` | Generation and stream/native ownership | VERIFIED | Tracks/late acquisitions released; geometry/blur/background invalidation; native context and explicit auto-start suppression. |
| `frontend/sections/Coach/CameraCheck.tsx`, `frontend/app/globals.css` | Four rows, fallback/manual actions and accessible layout | VERIFIED (implementation) | Real state renders, actionable reasons, one live region, scoped 48px/wrapping styles; device UX not certified. |
| `mobile/NativeTrackingCamera.tsx`, `mobile/App.tsx` | Optional native camera, bounded observations and session bridge | VERIFIED (implementation) | Captured callback identity, 5Hz/slow throttling, critical pause, startup deadline through configuration, lifecycle cleanup; mutually exclusive pose/ordinary preview. |
| Readiness Node/native/browser test files | Executable geometry, races, privacy, capability and continuation checks | VERIFIED | Actual shared module/adapter/hook code executes with explicit controlled boundaries; browser tracer retains actual local Worker/model. |
| `01-CALIBRATION.json`, `01-VALIDATION.md` | Honest calibration and reproducible verification record | VERIFIED as pending evidence artifacts | JSON schema 1, mediaStored=false; three untested surfaces and all 45 trial statuses pending. Not completed calibration. |

The artifact helper passed Plan 01 4/4. Existence results were followed by substantive source inspection and manual wiring/data-flow traces; they were not treated as behavior proof.

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| CameraCheck | useCameraStream/useCameraReadiness | Video/frame refs, active/native state, generation | WIRED | Live returned snapshot feeds each row; continuation stops owner then invokes existing callback. |
| useCameraReadiness | pose.worker | Transferred ImageBitmap/session/frame identity | WIRED | Worker response is checked for current identity and consumed by controller. Untransferred bitmap is finally-closed. |
| Browser/native consumer | shared evaluator/controller | Validated observations/current generation/local receipt time | WIRED | Shared implementation is imported and called; no product policy override. |
| useCameraStream | mobile/App | `camera-start` / frame / overlay messages | WIRED | Host validates context and actual preview dimensions before camera routing. |
| NativeTrackingCamera | useCameraReadiness | Native host `readinessScript`, fixed `physiquequest-camera-readiness` event | WIRED | Host checks instance identity; serialized payload escapes `<`; receiver validates envelope and latches terminal failures. |
| Calibration guard | JSON and policy | Filesystem reads and trial/value assertions | WIRED | Guard executes against actual record and transpiled production policy; pending data cannot authorize enabled flags. |
| CameraCheck | Existing workout/upload flows | onStart and explicit Analyze video | WIRED | Start is independent of check count; explicit upload retains selected-media payload. |

The generic Plan 02 key-link helper reported 0/3 because its textual target-path heuristic cannot follow bridge events (and did not resolve the relative shared import). Manual import/call and producer/event/consumer tracing above establishes the actual links; its output is not a missing-wiring finding.

### Data-Flow Trace (Level 4)

| Rendered value | Source → transformations → render | Status |
|---|---|---|
| Browser connection | Advancing requestVideoFrameCallback mediaTime (or decoded currentTime fallback) → controller.frame/dwell/expiry → readiness.connection → Camera connection row | FLOWING; local real-frame API, fake capture in automation |
| Browser body/brightness/framing | Video bitmap → local MediaPipe + transient pixel sample → validated shared evaluate/observe → snapshot → rows | FLOWING; calibration gates deliberately yield unknown/unavailable |
| Native checks | Native PoseFrame/additionalData → compact adapter observation → escaped host event → local-clock validated receiver → same snapshot/rows | FLOWING in software fixture; physical native source unverified |
| Native framing overlay | Evaluator framing → status bridge → validated fixed-vocabulary host state → nativeFramingText | FLOWING; native visual agreement pending |
| Manual workout | Unrestricted continuation → existing onStart → workout-create API path | FLOWING in intercepted browser regression; live persistence outside this verification |
| Explicit upload | Selected video → type/size checks → FileReader → user-triggered api.analyzePose → returned analysis render | FLOWING in mocked regression; separate from live readiness |

No readiness render terminates in invented passing data. False calibration flags and null physical observations are purposeful safeguards/pending records, not stubs or hollow props.

### Behavioral Spot-Checks

Fresh verifier runs below all exited 0, with zero skips. Commands used `rtk proxy node --test --test-name-pattern='<names>' <file>`; the exact selected test names are listed to keep reproduction bounded.

| File and selected names | Result | Status |
|---|---|---|
| `frontend/tests/camera-readiness.test.mjs`: `fake clock dwell needs advancing frames and duplicate input cannot extend expiry`; `generation change late reply invalid evidence and backwards clock clear affected passes` | 2/2, 343ms | PASS |
| `mobile/camera-readiness.test.mjs`: `live-session hook suppresses lifecycle auto-restart but preserves ordinary stop intent and explicit restart`; `native startup deadline covers asset-resolved silent camera initialization and clears on configure/error/teardown` | 2/2, 476ms | PASS |
| `frontend/tests/camera-readiness.test.mjs`: `complete body gives independent synthetic evidence; zero person still allows brightness`; `bounds and malformed evidence reject without guessing confidence`; `cover crop, portrait/landscape and a single mirror match visible coordinates`; `small whole upright body may request closer; bent ambiguous body never does` | 4/4, 360ms | PASS |
| `mobile/camera-readiness.test.mjs`: `receiver owns monotonic receipt freshness and accepts no camera-ready-only evidence`; `receiver rejects malformed, nonfinite, future, oversized, missing geometry, wrong type and old sessions`; `terminal capability/error/interruption cannot be revived by old frames or a pending reset`; `adapter rejects duplicate sequence, throttles serious/slow work, and critical thermal state deactivates`; `captured callbacks reject obsolete jobs, geometry/lens/zoom changes and lifecycle resume` | 5/5, 824ms | PASS |
| `rtk proxy node --test frontend/tests/camera-readiness-calibration.test.mjs` | 4/4, 373ms | PASS |

**Independent spot-check total: 17/17.** These runs exercise production code with simulated platform boundaries and synthetic policy inputs. No server/service was started, no physical camera was used, and no full browser/build suite was redundantly rerun.

The orchestrator supplied observed final execution results, retained in VALIDATION: Node 63/63, mocked backend pose 3/3, mobile TypeScript pass, frontend build pass/17 routes, and browser 30/30 (28 readiness plus two existing regressions), zero skips. Those broader results are recorded execution evidence, not independently rerun here. SUMMARY narration alone was not used as proof: source links, substantive test assertions and the focused executions above were checked independently. Build success proves compilation; fake browser/native tests do not prove a physical camera, provider or database.

### Probe Execution

Not applicable: this feature phase declares ordinary Node/browser checks, not migration/tooling probes or probe PASS markers. No declared probe was substituted with narration.

### Requirements Coverage

| Requirement | Source plans | Status | Evidence / remaining limit |
|---|---|---|---|
| READY-01 | 01, 02 | SATISFIED — software | Separate advancing frame channel and native frame receiver; configured-only fallback never establishes connection. Actual camera delivery pending. |
| READY-02 | 01, 02 | NEEDS HUMAN | Credible full-body/cover/mirror software exists and synthetic cases pass; physical geometry/calibration unresolved, flag false. |
| READY-03 | 01, 02 | NEEDS HUMAN | Local normalized web brightness/native luminance and honest copy implemented; actual exposure/threshold evidence absent, flag false. |
| READY-04 | 01, 02 | NEEDS HUMAN | Conservative upright framing/no missing-body closer claim tested; physical calibration absent, flag false. |
| READY-05 | 01, 02 | SATISFIED — software | Bounded validation, one in flight, dwell, sequence, expiry and thermal-throttle logic with executed tests. |
| READY-06 | 01, 02 | SATISFIED — software; device confirmation pending | Current-session guards and teardown tested, including both review fixes; real OS/thermal/resource observations still required. |
| READY-07 | 02, 03 | NEEDS HUMAN | Local adapters and preserved contracts implemented; current Android/iOS build execution not established. |
| READY-08 | 01, 02 | SATISFIED — software; device confirmation pending | Capability/permission/error fallback and unrestricted manual paths are wired and exercised with controlled boundaries. |
| READY-09 | 01, 02, 03 | SATISFIED — scoped software evidence | No readiness API/media storage path in production trace; browser interception/compact bridge tests preserve explicit upload separately. No new readiness credentials/schema/records. |
| READY-10 | 01, 02, 03 | NEEDS HUMAN | Accessible DOM/text/style and automated geometry assertions exist; OS screen readers, native scaling and actual usability pending. |
| READY-11 | 03 | SATISFIED — software | Geometry/invalid/freshness/native/privacy/workout/provider fixtures implemented; recorded full execution plus fresh focused 17/17. |
| READY-12 | 03 | NEEDS HUMAN | Honest pending matrix/provenance guard implemented; 0/45 physical trials observed and checkpoint not approved. |

All READY-01–READY-12 IDs appear in plan frontmatter and map to Phase 1. **Orphaned requirements: 0.** Software satisfaction here does not advance the overall requirement status or certify deployment/hardware.

### Decision Coverage

`check.decision-coverage-verify` returned **7/7 honored**, none missing: “All trackable CONTEXT.md decisions are honored by shipped artifacts.” Source inspection corroborates D-01 local-only processing, D-02 approximate copy, D-03 manual continuation, D-04 existing architecture/contracts, D-05 ephemeral freshness/cleanup, D-06 existing accessible layout implementation, and D-07 separate synthetic/physical evidence. Physical fulfillment of D-06/D-07 is still pending.

### Anti-Patterns and Test Quality

No unreferenced TBD/FIXME/XXX, TODO/HACK/PLACEHOLDER or disabled/todo test markers were found in the inspected readiness production/test paths. Empty initial state and null pending trial notes are populated/reset deliberately; they do not manufacture user-visible passing evidence. One-in-flight and finally-close code were traced, not inferred from file existence.

The shared evaluator tests transpile actual production code; native tests execute the adapter/receiver and hook/component with injected boundaries. The browser tracer subclasses the real Worker and waits for actual local model results. Network/manual/upload assertions observe requests and navigation. The calibration positive fixture fabricates only in-memory validator inputs and never writes device outcomes; it proves guard consistency, not camera accuracy. No circular golden-generation or requirement-disabled tests were identified. Some legacy source assertions prove structural contracts only and were not promoted into physical or runtime proof.

Disconfirmation checks retained three concrete limits: READY-12 is only partially achieved; synthetic native tracer success does not prove a phone; actual permission/thermal/OS accessibility paths have no physical test evidence. The previously found lifecycle restart and native startup-deadline paths now have passing executable regressions.

### Human Verification Required

1. **Geometry and calibration on actual web, Android and iOS builds.** Open Coach → Start session → Camera check on a real supported browser, then development builds containing the installed native pose module. Record device/OS/build revision/capability. Execute the 15 JSON case IDs per surface, including both lenses, rotation, cover crop/mirroring, clipping, body diversity/occlusion and dim/bright/backlit/covered scenes. Expect fresh connection independent of detection and no false full-body/closer claims. All currently uncalibrated checks must stay Unavailable. Store scalar observations and limitations only; record missing targets explicitly. Native preview agreement is a non-inferable backstop; no mathematical or fake-camera substitute suffices.
2. **Lifecycle, performance and continuation.** On those same devices test denial/revocation/busy camera, switch, background/notification shade, lock/unlock, exit/reopen, failure and slow/thermal operation. Expect immediate invalidation, fresh observations on restart, released obsolete resources, bounded work and normal camera-off/manual session continuation. Record latency/heat/cleanup symptoms and false greens per trial.
3. **Native accessibility and approval.** Verify TalkBack and VoiceOver focus/announcements, system text scale 1.5+, unclipped labels/actions and 48px/dp targets. Review actual results and calibrated/unavailable decisions with the executor. Apply only evidence-supported policy values with trial IDs, rerun Task 01-03-02's guard/build/browser checks after changes, then resolve the blocking checkpoint. Current shared `native` flags require evidence from both Android and iOS; one device cannot authorize a global native flag.

### Gaps Summary

No missing/stub/unwired software deliverable was established. The remaining work is **physical verification and calibration**, not another speculative implementation gap. The single-phase roadmap contains no later phase to defer it to. Both native backstops abstain because direct evidence is absent (`insufficient_spec`); they are warnings routed to human verification. No overrides or prohibitions were declared, and no approval was inferred.

Plans 01/02 and Plan 03 Task 1 have corroborated software evidence. Plan 03 Task 2, READY-12 and final phase sign-off remain pending. `human_needed` has precedence over a passing software result; this report does not mark the phase passed, change planning state, enable calibration flags or authorize checkpoint approval.

---

_Verified: 2026-10-20T16:45:25Z_
_Verifier: Codex (gsd-verifier)_
