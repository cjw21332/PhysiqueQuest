# Phase 1: Camera Readiness — Pattern Map

**Mapped:** 2026-10-20
**Scope:** Planning only. Proposed new filenames below are discretionary; existing integration paths are fixed by the current app.
**Files classified:** 15 logical files/targets. **Analogs:** 15/15 have structural or role matches; new readiness semantics have no exact implementation analog.

## File Classification

| New/modified file | Role | Data flow | Closest tracked analog | Match quality |
|---|---|---|---|---|
| `shared/cameraReadiness.ts` (proposed) | utility | transform | `shared/repCounter.ts` | role-match |
| `frontend/hooks/useCameraReadiness.ts` (proposed) | hook | event-driven | `frontend/hooks/useRepTracking.ts` | role-match |
| `frontend/workers/pose.worker.ts` | service | streaming | same file | exact extension point |
| `frontend/hooks/useCameraStream.ts` | hook | streaming | same file | exact extension point |
| `frontend/lib/cameraReadiness.ts` | utility | transform | same file | status/display match only |
| `frontend/sections/Coach/CameraCheck.tsx` | component | event-driven | same file | exact extension point |
| `mobile/NativeTrackingCamera.tsx` | component | streaming | same file | exact extension point |
| `mobile/App.tsx` | controller | event-driven | `mobile/NativeTrackingCamera.tsx` | bridge role-match; routing existing |
| `frontend/tests/camera-readiness.test.mjs` (proposed) | test | transform | `frontend/tests/rep-counter.test.mjs` | role-match |
| `frontend/tests/camera-readiness-lifecycle.test.mjs` (proposed) | test | event-driven | `frontend/tests/rep-counter.test.mjs` | partial: deterministic replay only |
| `frontend/tests/device-readiness.test.mjs` | test | event-driven | `frontend/tests/rep-counter.test.mjs` | test-style match |
| `frontend/tests/pose-flow.test.mjs` | test | request-response | `frontend/tests/rep-counter.test.mjs` | test-style match |
| `frontend/tests/mobile-redesign.test.mjs` | test | transform | `frontend/tests/rep-counter.test.mjs` | test-style match |
| `frontend/tests/browser/pose-tracking.spec.mjs` | test | event-driven | same file (research-inspected regression target) | existing browser harness |
| `backend/test/pose-analysis.spec.ts` (regression only) | test | request-response | same file (research-inspected regression target) | existing provider contract |

No backend implementation, migration, package, media storage, or state-library file is needed. Existing tests are regression targets, not a requirement to edit all of them. Add focused test files only where necessary. Browser/backend harness details are already documented in RESEARCH.md; do not copy the Node transpilation harness into their framework-specific tests.

## Pattern Assignments

### Shared evaluator and display contract

**Analog:** `shared/repCounter.ts`, lines 1–6, 23–34, 37–70. Copy the dependency-free exported types/functions and explicit invalid-input handling. Relative shared imports already work from both platforms (`../../shared/repCounter` on web; `../shared/repCounter` on native).

Validation excerpt (lines 23–29):

```ts
export function jointAngle(frame: TrackingFrame): number | null {
  if (!(frame.aspect > 0) || !Number.isFinite(frame.aspect) || frame.joints.length !== 3) return null;
  if (frame.joints.some(joint => !joint || !Number.isFinite(joint.x) || !Number.isFinite(joint.y) ||
    joint.x < 0 || joint.x > 1 || joint.y < 0 || joint.y > 1 ||
    (joint.visibility ?? 0) < 0.65 || !Number.isFinite(joint.visibility) ||
    (joint.presence !== undefined && (!Number.isFinite(joint.presence) || joint.presence < 0.65)))) return null;
```

Temporal reset excerpt (lines 49–55):

```ts
resetMotion() { clearMotion(); lastTimestamp = -Infinity; return snapshot(); },
update(frame: TrackingFrame): CounterSnapshot {
  if (!Number.isFinite(frame.timestamp) || frame.timestamp <= lastTimestamp) return snapshot();
  if (frame.timestamp - lastTimestamp > 600) clearMotion();
  lastTimestamp = frame.timestamp;
  const angle = jointAngle(frame);
  if (angle === null) { clearMotion(); return snapshot(); }
```

Copy the finite-number, missing-confidence, order, and reset patterns, **not** the three-joint schema, angle calculation, thresholds or rep-preserving behavior. Readiness needs full landmarks, geometry, independent check evidence and immediate invalidation. Thresholds require calibration.

**Display analog:** `frontend/lib/cameraReadiness.ts`, lines 1–9:

```ts
export type ReadinessCheck = {
  status: 'ready' | 'adjust' | 'unknown';
  label: string;
};
```

Preserve the vocabulary; replace the live numeric-distance/parser dependency. Its permissive provider string parsing is unsuitable for local observation validation. Approximate framing and camera freshness need explicit contracts.

### Browser readiness hook and worker lifecycle

**Analog:** `frontend/hooks/useRepTracking.ts`, lines 1–4, 14–43, 45–85. Use a separate readiness hook; do not instantiate the rep hook or require an exercise selection.

Imports (lines 1–4):

```ts
'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import { createRepCounter, type TrackingFrame, type TrackingKind, type TrackingSide } from '../../shared/repCounter';
```

Worker creation and failure (lines 51–55):

```ts
let worker: Worker;
try { worker = new Worker(new URL('../workers/pose.worker.ts', import.meta.url)); }
catch { setStatus('Camera tracking could not start. Count reps manually.'); clearInterval(staleTimer); return; }
let ready = false, busy = false, lastSent = 0, lastVideoTime = -1, sentAt = 0, interval = 100;
const fail = (message: string) => { setStatus(message); ready = false; busy = false; clearInterval(staleTimer); worker.terminate(); };
```

Acquisition and late bitmap cleanup (lines 74–81):

```ts
if (stopped || !ready || busy || !video || video.readyState < 2 || now - lastSent < interval || video.currentTime === lastVideoTime) return;
busy = true; lastSent = now; sentAt = now; lastVideoTime = video.currentTime;
try {
  const width = Math.min(480, video.videoWidth);
  const bitmap = await createImageBitmap(video, { resizeWidth: width, resizeHeight: Math.max(1, Math.round(video.videoHeight * width / video.videoWidth)) });
  if (stopped || !ready) { bitmap.close(); return; }
  worker.postMessage({ type: 'frame', bitmap, timestamp: now, kind, side }, [bitmap]);
} catch { if (!stopped) fail('The camera frame could not be analyzed. Count reps manually.'); }
```

Cleanup (line 83):

```ts
return () => { stopped = true; clearInterval(timer); clearInterval(staleTimer); clearTimeout(initTimeout); worker.terminate(); counter.resetMotion(); };
```

Extend this with camera-generation identity, lifecycle invalidation and freshness independent of pose detection. Existing `stopped` guards alone do not prove current-session camera delivery. Failure must clear readiness immediately; do not copy a fail handler that merely changes status while retaining a green snapshot.

**Worker analog:** `frontend/workers/pose.worker.ts`, lines 1–18, 21–32. Keep CPU/local assets, VIDEO inference, typed commands, and the existing rep result contract. Add a distinct readiness command/result.

```ts
// lines 22–25
if (!detector) throw new Error('Detector unavailable');
const start = performance.now();
const result = detector.detectForVideo(command.bitmap, command.timestamp);
const landmarks = result.landmarks[0] ?? [];
```

```ts
// lines 30–31
} catch { scope.postMessage({ type: 'error', message: 'Camera tracking stopped. Try restarting it or count reps manually.' }); }
finally { command.bitmap.close(); }
```

Readiness must retain full landmarks **before** `jointIndices` reduces the result. Compute small transient brightness samples locally; never emit pixels/base64. Shared evaluator stays free of worker/DOM imports.

### Camera acquisition and UI integration

**Analog:** `frontend/hooks/useCameraStream.ts`, lines 61–85 (release/stop), 141–151 (obsolete stream release), 281–300 (effect cleanup). Existing explicit camera ownership is the pattern:

```ts
// lines 61–65
const release = useCallback(() => {
  streamRef.current?.getTracks().forEach(track => track.stop());
  streamRef.current = null;
  if (videoRef.current) videoRef.current.srcObject = null;
}, []);
```

Increment session/generation before asynchronous stop/start; keep late-stream release. Existing `play().catch(() => undefined)` followed by `status='on'` does not establish fresh frames. Existing `captureFrame()` photo/base64 flow is not the local-readiness acquisition pattern.

**UI integration:** `frontend/sections/Coach/CameraCheck.tsx`, lines 1–8 and final `ReadinessRow` helper. Keep current imports/classes, explicit text labels, `role="status"`/`role="alert"`, and accessible controls. Replace live provider readiness only; preserve the upload analysis path. Manual continuation must call camera stop before advancing and remain available on unknown/unsupported checks. Readiness lives in mounted memory, never API/cache persistence.

### Native readiness mode and compact bridge

**Analog:** `mobile/NativeTrackingCamera.tsx`, lines 1–14, 17–61. Capability gating and escaped JSON bridge (lines 8–14):

```ts
export type NativeTrackingOptions = { requestId: string; kind: TrackingKind; side: TrackingSide; active: boolean };
export const nativePoseAvailable = !isRunningInExpoGo() && !!requireOptionalNativeModule('ExpoMediaPipePose');
// Expo Go keeps the normal camera usable without loading an unavailable native view.
const PoseCamera = nativePoseAvailable ? (require('expo-mediapipe-pose') as typeof import('expo-mediapipe-pose')).PoseCameraView : null;

export function poseScript(detail: Record<string, unknown>) {
  return `(function(){window.dispatchEvent(new CustomEvent('physiquequest-pose',{detail:${JSON.stringify(detail).replace(/</g, '\\u003c')}}));})();true;`;
}
```

Lifecycle reset (lines 33–37):

```ts
const listener = AppState.addEventListener('change', state => {
  setForeground(state === 'active');
  send({ type: 'reset' });
});
return () => { active = false; listener.remove(); };
```

Copy optional module loading, bundled Asset model loading, active gating, thermal pause/error callbacks and request identity. Add readiness mode independent of kind/side. Preserve full landmarks and native metadata before rep reduction; normalize local receipt time, frame sequence, dimensions, mirroring and luminance. Validate the compact receiving payload; do not trust `Record<string, unknown>` as runtime validation.

`mobile/App.tsx` routing is the existing integration point: import at line 24; context validation at lines 48–51; pose preview branch at lines 436–450; mutually exclusive ordinary preview at lines 452 onward. Extend that discriminated routing to camera-check readiness while keeping exactly one preview. Replace the static distance overlay and keep Expo Go/manual fallback. Do not reuse the photo capture at line 386 for readiness.

### Test style

**Analog:** `frontend/tests/rep-counter.test.mjs`, lines 1–17, 39–53, 62–75. Existing Node tests execute transpiled dependency-free shared TypeScript without a new framework:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../../shared/repCounter.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { createRepCounter, jointAngle, trackingExercises } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
```

Copy deterministic synthetic builders/replays and table-driven malformed/uncertain/offscreen/stale cases. Use explicit timestamps/fake time for dwell, expiry, duplicates, late results and generation switches; avoid wall-clock sleeps. The data-URL harness works for dependency-free modules; relative-import modules need an appropriate existing loader or separately testable controller boundary. Test observable decisions/resource release, not only source-string presence. Use existing browser regressions for camera-off continuation and no readiness upload requests. Device calibration remains separate evidence.

## Shared Patterns

- **Imports:** shared pure TypeScript via relative paths; client hooks declare `'use client'`; native external types use `import type`.
- **Auth:** no new readiness endpoint or credential. Existing upload/workout API contracts remain unchanged.
- **Validation:** finite numbers, bounded confidence, valid dimensions, current generation and advancing frame identity; unknown on insufficient evidence.
- **Errors:** user-facing actionable messages plus resource disposal; invalidate all affected readiness evidence on stop, background, failure and geometry change.
- **Bridge:** existing `JSON.stringify` plus `<` escaping; fixed event structure with request/session correlation. Never serialize frames or log base64 for readiness.
- **State:** local React state/refs and pure evaluator/controller; no Redux, persistence, saved green result or API readiness record.

## No Exact Semantic Analog Found

| Capability | Closest partial source | Missing behavior to implement from RESEARCH.md |
|---|---|---|
| Whole-body readiness | `shared/repCounter.ts` | Full-body visibility, crop projection, independent lighting/framing checks |
| Scene brightness | `frontend/workers/pose.worker.ts` | Browser pixel sampling and normalized scalar |
| Readiness lifecycle tests | `frontend/tests/rep-counter.test.mjs` | Worker/native acquisition mocks, resource cleanup and camera generation |
| Native readiness mode | `mobile/NativeTrackingCamera.tsx` | Mode independent of exercise and compact full-observation bridge |

## Metadata

**Analog search scope:** tracked `shared/`, `frontend/hooks/`, `frontend/workers/`, `frontend/lib/`, `frontend/sections/Coach/`, `frontend/tests/`, `mobile/`.
**Detailed source files read:** 8; native App routing located by targeted search. Six principal pattern families extracted above; source integration files are also named where necessary.
**Tracked-source gate:** analog paths verified with `git ls-files`; no installed runtime or dependency mirror is assigned as an analog. Research-only regression targets retain their existing harness and are not new copy sources.
**Pattern extraction date:** 2026-10-20. No tests or hardware validation run for this planning artifact.
